const express = require('express');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const { validate, validateId, appointmentSchemas } = require('../middleware/validation');
const { authenticateToken, requireAdmin, requireAdminOrManager, requireEmployee, checkResourceOwnership } = require('../middleware/auth');

const router = express.Router();

// GET /api/appointments - Récupérer tous les rendez-vous
router.get('/', authenticateToken, requireEmployee, validate(appointmentSchemas.query, 'query'), async (req, res) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      employee_id: req.query.employee_id,
      client_id: req.query.client_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    // Les coiffeurs ne peuvent voir que leurs propres rendez-vous
    if (req.user.role_name === 'coiffeur') {
      const { executeQuery } = require('../config/database');
      const employeeQuery = 'SELECT id FROM employees WHERE user_id = ?';
      const employeeResults = await executeQuery(employeeQuery, [req.user.id]);
      
      if (employeeResults.length > 0) {
        filters.employee_id = employeeResults[0].id;
      }
    }

    const appointments = await Appointment.findAll(filters);
    
    res.json({
      appointments: appointments.map(appointment => appointment.toPublicJSON())
    });
  } catch (error) {
    console.error('Erreur récupération rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments/:id - Récupérer un rendez-vous spécifique
router.get('/:id', authenticateToken, validateId, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    // Vérifier les permissions
    const canAccess = 
      req.user.role_name === 'admin' || 
      req.user.role_name === 'manager' ||
      appointment.client_user_id === req.user.id ||
      (req.user.role_name === 'coiffeur' && appointment.employee_id);

    if (!canAccess) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    res.json(appointment.toPublicJSON());
  } catch (error) {
    console.error('Erreur récupération rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/appointments - Créer un nouveau rendez-vous
router.post('/', authenticateToken, validate(appointmentSchemas.create), async (req, res) => {
  try {
    const { client_user_id, service_id, start_datetime, employee_id, notes } = req.body;

    // Vérifier que le service existe
    const service = await Service.findById(service_id);
    if (!service) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }

    // Vérifier les permissions
    const canCreate = 
      req.user.role_name === 'admin' || 
      req.user.role_name === 'manager' ||
      client_user_id === req.user.id;

    if (!canCreate) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const appointmentId = await Appointment.create({
      client_user_id,
      service_id,
      start_datetime,
      employee_id,
      notes
    });

    const newAppointment = await Appointment.findById(appointmentId);
    
    res.status(201).json(newAppointment.toPublicJSON());
  } catch (error) {
    console.error('Erreur création rendez-vous:', error);
    
    if (error.message.includes('conflit') || error.message.includes('plage horaire')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erreur serveur lors de la création' });
  }
});

// PATCH /api/appointments/:id/status - Changer le statut d'un rendez-vous
router.patch('/:id/status', authenticateToken, requireEmployee, validateId, validate(appointmentSchemas.updateStatus), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    // Vérifier les permissions
    const canUpdate = 
      req.user.role_name === 'admin' || 
      req.user.role_name === 'manager' ||
      (req.user.role_name === 'coiffeur' && appointment.employee_id);

    if (!canUpdate) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    await appointment.updateStatus(req.body.status, req.user.id, req.body.reason);
    
    const updatedAppointment = await Appointment.findById(req.params.id);
    res.json(updatedAppointment.toPublicJSON());
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/appointments/:id/assign - Assigner automatiquement un employé
router.post('/:id/assign', authenticateToken, requireAdminOrManager, validateId, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    if (appointment.employee_id) {
      return res.status(400).json({ error: 'Ce rendez-vous a déjà un employé assigné' });
    }

    await appointment.assignAutoEmployee();
    
    const updatedAppointment = await Appointment.findById(req.params.id);
    res.json(updatedAppointment.toPublicJSON());
  } catch (error) {
    console.error('Erreur assignation employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/appointments/:id - Annuler un rendez-vous
router.delete('/:id', authenticateToken, validateId, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    // Vérifier les permissions
    const canCancel = 
      req.user.role_name === 'admin' || 
      req.user.role_name === 'manager' ||
      appointment.client_user_id === req.user.id;

    if (!canCancel) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Ce rendez-vous est déjà annulé' });
    }

    const { reason } = req.body;
    await appointment.cancel(req.user.id, reason);
    
    res.json({ message: 'Rendez-vous annulé avec succès' });
  } catch (error) {
    console.error('Erreur annulation rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments/:id/history - Historique d'un rendez-vous
router.get('/:id/history', authenticateToken, requireEmployee, validateId, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    // Vérifier les permissions
    const canAccess = 
      req.user.role_name === 'admin' || 
      req.user.role_name === 'manager' ||
      appointment.client_user_id === req.user.id;

    if (!canAccess) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const history = await appointment.getHistory();
    res.json({ history });
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments/availability/:service_id - Créneaux disponibles
router.get('/availability/:service_id', validateId, async (req, res) => {
  try {
    const { service_id } = req.params;
    const { date, employee_id } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date requise' });
    }

    // Vérifier que le service existe
    const service = await Service.findById(service_id);
    if (!service) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }

    const availableSlots = await Appointment.getAvailableSlots(
      date, 
      service_id, 
      employee_id ? parseInt(employee_id) : null
    );

    res.json({
      service: service.toPublicJSON(),
      date,
      available_slots: availableSlots
    });
  } catch (error) {
    console.error('Erreur récupération disponibilités:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments/my - Mes rendez-vous (pour les clients)
router.get('/my/appointments', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      client_id: req.user.id,
      status
    };

    const appointments = await Appointment.findAll(filters);
    
    res.json({
      appointments: appointments.map(appointment => appointment.toPublicJSON())
    });
  } catch (error) {
    console.error('Erreur récupération mes rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

