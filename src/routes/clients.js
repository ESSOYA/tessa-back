const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery } = require('../config/database');

const router = express.Router();

// GET /api/clients - Récupérer tous les clients avec leurs statistiques
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = `
      WHERE r.name = 'client' AND u.is_active = 1
    `;
    let params = [];

    if (search) {
      whereClause += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.created_at,
        COUNT(DISTINCT a.id) as total_appointments,
        COALESCE(SUM(CASE WHEN a.status IN ('confirmed', 'completed') THEN s.price ELSE 0 END), 0) as total_spent,
        MAX(a.start_datetime) as last_appointment_date
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN appointments a ON a.client_user_id = u.id
      LEFT JOIN services s ON s.id = a.service_id
      ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));
    const clients = await executeQuery(query, params);

    // Compter le total
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ${whereClause.replace('GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at', '')}
    `;
    const countParams = params.slice(0, -2); // Enlever limit et offset
    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      clients: clients.map(client => ({
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone: client.phone,
        total_appointments: parseInt(client.total_appointments) || 0,
        total_spent: parseFloat(client.total_spent) || 0,
        last_appointment_date: client.last_appointment_date,
        created_at: client.created_at,
        is_active: true
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Erreur récupération clients:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des clients' });
  }
});

// GET /api/clients/:id/history - Historique des réservations d'un client (doit être avant /:id)
router.get('/:id/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer les infos du client
    const clientQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.name = 'client' AND u.is_active = 1
    `;
    const clientResults = await executeQuery(clientQuery, [id]);
    
    if (clientResults.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    const query = `
      SELECT 
        a.id,
        a.start_datetime,
        a.end_datetime,
        a.status,
        a.notes,
        a.created_at,
        s.name as service_name,
        s.price,
        CONCAT(ue.first_name, ' ', ue.last_name) as employee_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users ue ON ue.id = e.user_id
      WHERE a.client_user_id = ?
      ORDER BY a.start_datetime DESC
    `;

    const appointments = await executeQuery(query, [id]);

    res.json({
      client: clientResults[0],
      history: appointments.map(apt => ({
        id: apt.id,
        service_name: apt.service_name,
        start_datetime: apt.start_datetime,
        end_datetime: apt.end_datetime,
        status: apt.status,
        notes: apt.notes,
        price: parseFloat(apt.price) || 0,
        employee_name: apt.employee_name,
        created_at: apt.created_at
      }))
    });
  } catch (error) {
    console.error('Erreur récupération historique client:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'historique' });
  }
});

// GET /api/clients/:id - Récupérer les informations d'un client
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.created_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.name = 'client' AND u.is_active = 1
    `;

    const results = await executeQuery(query, [id]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    res.json({ client: results[0] });
  } catch (error) {
    console.error('Erreur récupération client:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du client' });
  }
});

module.exports = router;

