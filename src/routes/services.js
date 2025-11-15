const express = require('express');
const Service = require('../models/Service');
const { validate, validateId, serviceSchemas } = require('../middleware/validation');
const { authenticateToken, requireAdmin, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// GET /api/services - Récupérer tous les services
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', activeOnly = 'false' } = req.query;
    
    // Pour l'admin, on veut voir tous les services (actifs et inactifs)
    // Pour les clients, on veut seulement les actifs
    const activeOnlyBool = activeOnly === 'true';
    
    const services = await Service.findWithPagination(
      parseInt(page), 
      parseInt(limit), 
      search,
      activeOnlyBool
    );
    
    const total = await Service.count(search, activeOnlyBool);
    
    res.json({
      services: services.map(service => service.toPublicJSON()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur récupération services:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/services/:id - Récupérer un service spécifique
router.get('/:id', validateId, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }
    
    res.json(service.toPublicJSON());
  } catch (error) {
    console.error('Erreur récupération service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/services - Créer un nouveau service (Admin uniquement)
router.post('/', authenticateToken, requireAdmin, validate(serviceSchemas.create), async (req, res) => {
  try {
    const { name, description, duration_minutes, price } = req.body;
    
    // Vérifier si un service avec ce nom existe déjà
    const existingService = await Service.findWithPagination(1, 1, name);
    if (existingService.length > 0) {
      return res.status(409).json({ error: 'Un service avec ce nom existe déjà' });
    }
    
    const serviceId = await Service.create({
      name,
      description,
      duration_minutes,
      price
    });
    
    const newService = await Service.findById(serviceId);
    
    res.status(201).json(newService.toPublicJSON());
  } catch (error) {
    console.error('Erreur création service:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création' });
  }
});

// PUT /api/services/:id - Mettre à jour un service (Admin uniquement)
router.put('/:id', authenticateToken, requireAdmin, validateId, validate(serviceSchemas.update), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }
    
    const success = await service.update(req.body);
    
    if (!success) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }
    
    const updatedService = await Service.findById(req.params.id);
    res.json(updatedService.toPublicJSON());
  } catch (error) {
    console.error('Erreur mise à jour service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/services/:id - Supprimer un service (Admin uniquement)
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }
    
    // Vérifier s'il y a des rendez-vous liés à ce service
    const { executeQuery } = require('../config/database');
    const appointmentsQuery = `
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE service_id = ? AND status IN ('pending', 'confirmed')
    `;
    const results = await executeQuery(appointmentsQuery, [req.params.id]);
    
    if (results[0].count > 0) {
      return res.status(409).json({ 
        error: 'Impossible de supprimer ce service car il a des rendez-vous actifs' 
      });
    }
    
    await service.delete();
    res.json({ message: 'Service supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/services/:id/stats - Statistiques d'un service (Admin/Manager)
router.get('/:id/stats', authenticateToken, requireAdminOrManager, validateId, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }
    
    const stats = await service.getStats();
    res.json({
      service: service.toPublicJSON(),
      stats
    });
  } catch (error) {
    console.error('Erreur statistiques service:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/services/active - Récupérer seulement les services actifs (public)
router.get('/public/active', async (req, res) => {
  try {
    const services = await Service.findAll(true);
    res.json(services.map(service => service.toPublicJSON()));
  } catch (error) {
    console.error('Erreur récupération services actifs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

