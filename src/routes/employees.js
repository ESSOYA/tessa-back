const express = require('express');
const moment = require('moment');
const { executeQuery } = require('../config/database');
const { validate, validateId, employeeSchemas } = require('../middleware/validation');
const { authenticateToken, requireAdmin, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// GET /api/employees - Récupérer tous les employés
router.get('/', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1'; // Récupérer tous les employés, pas seulement ceux disponibles
    let params = [];

    if (search) {
      whereClause += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const query = `
      SELECT e.id, e.user_id, e.hire_date, e.note, e.is_available,
             u.first_name, u.last_name, u.email, u.phone, u.created_at
      FROM employees e
      JOIN users u ON u.id = e.user_id
      ${whereClause}
      ORDER BY u.first_name, u.last_name
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), offset);
    const employees = await executeQuery(query, params);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      JOIN users u ON u.id = e.user_id
      ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Enlever limit et offset
    const countResults = await executeQuery(countQuery, countParams);
    const total = countResults[0].total;

    res.json({
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur récupération employés:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/employees/:id - Récupérer un employé spécifique
router.get('/:id', authenticateToken, requireAdminOrManager, validateId, async (req, res) => {
  try {
    const query = `
      SELECT e.*, u.first_name, u.last_name, u.email, u.phone, u.created_at
      FROM employees e
      JOIN users u ON u.id = e.user_id
      WHERE e.id = ?
    `;
    
    const results = await executeQuery(query, [req.params.id]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    const employee = results[0];

    // Récupérer les horaires de travail
    const workingHoursQuery = `
      SELECT jour_semaine, start_time, end_time
      FROM working_hours
      WHERE employee_id = ?
      ORDER BY jour_semaine
    `;
    const workingHours = await executeQuery(workingHoursQuery, [req.params.id]);

    // Récupérer les statistiques
    const statsQuery = `
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments
      FROM appointments
      WHERE employee_id = ?
    `;
    const statsResults = await executeQuery(statsQuery, [req.params.id]);
    const stats = statsResults[0];

    res.json({
      ...employee,
      working_hours: workingHours,
      stats
    });
  } catch (error) {
    console.error('Erreur récupération employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/employees - Créer un nouvel employé
router.post('/', authenticateToken, requireAdmin, validate(employeeSchemas.create), async (req, res) => {
  try {
    const { user_id, hire_date, note } = req.body;

    // Vérifier que l'utilisateur existe et a le bon rôle
    const userQuery = `
      SELECT u.id, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.is_active = 1
    `;
    const userResults = await executeQuery(userQuery, [user_id]);

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (!['coiffeur', 'manager'].includes(userResults[0].role_name)) {
      return res.status(400).json({ error: 'L\'utilisateur doit avoir le rôle coiffeur ou manager' });
    }

    // Vérifier que l'utilisateur n'est pas déjà employé
    const existingEmployeeQuery = 'SELECT id FROM employees WHERE user_id = ?';
    const existingResults = await executeQuery(existingEmployeeQuery, [user_id]);

    if (existingResults.length > 0) {
      return res.status(409).json({ error: 'Cet utilisateur est déjà un employé' });
    }

    const insertQuery = `
      INSERT INTO employees (user_id, hire_date, note)
      VALUES (?, ?, ?)
    `;
    const result = await executeQuery(insertQuery, [user_id, hire_date, note]);

    res.status(201).json({
      id: result.insertId,
      user_id,
      hire_date,
      note,
      message: 'Employé créé avec succès'
    });
  } catch (error) {
    console.error('Erreur création employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/employees/:id - Mettre à jour un employé
router.put('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
  try {
    const { hire_date, note, is_available } = req.body;

    // Vérifier que l'employé existe
    const employeeQuery = 'SELECT id FROM employees WHERE id = ?';
    const employeeResults = await executeQuery(employeeQuery, [req.params.id]);

    if (employeeResults.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    const updates = [];
    const values = [];

    if (hire_date !== undefined) {
      updates.push('hire_date = ?');
      values.push(hire_date);
    }

    if (note !== undefined) {
      updates.push('note = ?');
      values.push(note);
    }

    if (is_available !== undefined) {
      updates.push('is_available = ?');
      values.push(is_available);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    values.push(req.params.id);
    const updateQuery = `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, values);

    res.json({ message: 'Employé mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur mise à jour employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/employees/:id - Supprimer un employé
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
  try {
    // Vérifier que l'employé existe
    const employeeQuery = 'SELECT id FROM employees WHERE id = ?';
    const employeeResults = await executeQuery(employeeQuery, [req.params.id]);

    if (employeeResults.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Vérifier s'il y a des rendez-vous futurs
    const appointmentsQuery = `
      SELECT COUNT(*) as count
      FROM appointments
      WHERE employee_id = ? AND start_datetime > NOW() AND status IN ('pending', 'confirmed')
    `;
    const appointmentResults = await executeQuery(appointmentsQuery, [req.params.id]);

    if (appointmentResults[0].count > 0) {
      return res.status(409).json({ 
        error: 'Impossible de supprimer cet employé car il a des rendez-vous futurs' 
      });
    }

    // Supprimer les horaires de travail
    await executeQuery('DELETE FROM working_hours WHERE employee_id = ?', [req.params.id]);
    
    // Supprimer l'employé
    await executeQuery('DELETE FROM employees WHERE id = ?', [req.params.id]);

    res.json({ message: 'Employé supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/employees/:id/working-hours - Ajouter des horaires de travail
router.post('/:id/working-hours', authenticateToken, requireAdmin, validateId, validate(employeeSchemas.workingHours), async (req, res) => {
  try {
    const { jour_semaine, start_time, end_time } = req.body;

    // Vérifier que l'employé existe
    const employeeQuery = 'SELECT id FROM employees WHERE id = ?';
    const employeeResults = await executeQuery(employeeQuery, [req.params.id]);

    if (employeeResults.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Vérifier s'il y a déjà des horaires pour ce jour
    const existingQuery = `
      SELECT id FROM working_hours 
      WHERE employee_id = ? AND jour_semaine = ?
    `;
    const existingResults = await executeQuery(existingQuery, [req.params.id, jour_semaine]);

    if (existingResults.length > 0) {
      return res.status(409).json({ error: 'Des horaires existent déjà pour ce jour' });
    }

    const insertQuery = `
      INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time)
      VALUES (?, ?, ?, ?)
    `;
    await executeQuery(insertQuery, [req.params.id, jour_semaine, start_time, end_time]);

    res.status(201).json({ message: 'Horaires ajoutés avec succès' });
  } catch (error) {
    console.error('Erreur ajout horaires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/employees/:id/working-hours/:day - Modifier les horaires d'un jour
router.put('/:id/working-hours/:day', authenticateToken, requireAdmin, validateId, async (req, res) => {
  try {
    const { start_time, end_time } = req.body;
    const day = parseInt(req.params.day);

    if (day < 1 || day > 7) {
      return res.status(400).json({ error: 'Jour de la semaine invalide (1-7)' });
    }

    // Vérifier que l'employé existe
    const employeeQuery = 'SELECT id FROM employees WHERE id = ?';
    const employeeResults = await executeQuery(employeeQuery, [req.params.id]);

    if (employeeResults.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    const updateQuery = `
      UPDATE working_hours 
      SET start_time = ?, end_time = ?
      WHERE employee_id = ? AND jour_semaine = ?
    `;
    const result = await executeQuery(updateQuery, [start_time, end_time, req.params.id, day]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Horaires non trouvés pour ce jour' });
    }

    res.json({ message: 'Horaires mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur mise à jour horaires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/employees/:id/working-hours/:day - Supprimer les horaires d'un jour
router.delete('/:id/working-hours/:day', authenticateToken, requireAdmin, validateId, async (req, res) => {
  try {
    const day = parseInt(req.params.day);

    if (day < 1 || day > 7) {
      return res.status(400).json({ error: 'Jour de la semaine invalide (1-7)' });
    }

    const deleteQuery = `
      DELETE FROM working_hours 
      WHERE employee_id = ? AND jour_semaine = ?
    `;
    const result = await executeQuery(deleteQuery, [req.params.id, day]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Horaires non trouvés pour ce jour' });
    }

    res.json({ message: 'Horaires supprimés avec succès' });
  } catch (error) {
    console.error('Erreur suppression horaires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/employees/available - Employés disponibles pour une date/heure
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const { date, time, service_id } = req.query;

    if (!date || !time || !service_id) {
      return res.status(400).json({ error: 'Date, heure et service requis' });
    }

    // Récupérer la durée du service
    const serviceQuery = 'SELECT duration_minutes FROM services WHERE id = ?';
    const serviceResults = await executeQuery(serviceQuery, [service_id]);

    if (serviceResults.length === 0) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }

    const duration = serviceResults[0].duration_minutes;
    const startDatetime = `${date} ${time}`;
    const endDatetime = moment(startDatetime).add(duration, 'minutes').format('YYYY-MM-DD HH:mm:ss');

    // Récupérer le jour de la semaine (1=Lundi, 7=Dimanche)
    const dayOfWeek = moment(date).day() === 0 ? 7 : moment(date).day();

    const availableQuery = `
      SELECT e.id, u.first_name, u.last_name, u.email
      FROM employees e
      JOIN users u ON u.id = e.user_id
      JOIN working_hours wh ON wh.employee_id = e.id
      WHERE e.is_available = 1
        AND u.is_active = 1
        AND wh.jour_semaine = ?
        AND wh.start_time <= ? AND wh.end_time >= ?
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.employee_id = e.id
            AND a.status IN ('pending', 'confirmed')
            AND NOT (a.end_datetime <= ? OR a.start_datetime >= ?)
        )
      ORDER BY u.first_name, u.last_name
    `;

    const availableEmployees = await executeQuery(availableQuery, [
      dayOfWeek,
      time,
      moment(endDatetime).format('HH:mm:ss'),
      startDatetime,
      endDatetime
    ]);

    res.json({
      date,
      time,
      service_id,
      available_employees: availableEmployees
    });
  } catch (error) {
    console.error('Erreur récupération employés disponibles:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
