const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery } = require('../config/database');

const router = express.Router();

// GET /api/stats/dashboard - Statistiques du tableau de bord admin
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Total des réservations
    const totalBookingsQuery = 'SELECT COUNT(*) as total FROM appointments';
    const totalBookingsResult = await executeQuery(totalBookingsQuery);
    const totalBookings = totalBookingsResult[0].total;

    // Réservations en attente
    const pendingBookingsQuery = "SELECT COUNT(*) as total FROM appointments WHERE status = 'pending'";
    const pendingBookingsResult = await executeQuery(pendingBookingsQuery);
    const pendingBookings = pendingBookingsResult[0].total;

    // Réservations confirmées
    const confirmedBookingsQuery = "SELECT COUNT(*) as total FROM appointments WHERE status = 'confirmed'";
    const confirmedBookingsResult = await executeQuery(confirmedBookingsQuery);
    const confirmedBookings = confirmedBookingsResult[0].total;

    // Réservations aujourd'hui
    const todayBookingsQuery = `
      SELECT COUNT(*) as total 
      FROM appointments 
      WHERE DATE(start_datetime) = CURDATE()
    `;
    const todayBookingsResult = await executeQuery(todayBookingsQuery);
    const todayBookings = todayBookingsResult[0].total;

    // Total des services actifs
    const totalServicesQuery = "SELECT COUNT(*) as total FROM services WHERE is_active = 1";
    const totalServicesResult = await executeQuery(totalServicesQuery);
    const totalServices = totalServicesResult[0].total;

    // Total des employés
    const totalEmployeesQuery = `
      SELECT COUNT(*) as total 
      FROM employees e
      JOIN users u ON u.id = e.user_id
      WHERE u.is_active = 1
    `;
    const totalEmployeesResult = await executeQuery(totalEmployeesQuery);
    const totalEmployees = totalEmployeesResult[0].total;

    // Total des clients
    const totalClientsQuery = `
      SELECT COUNT(*) as total 
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'client' AND u.is_active = 1
    `;
    const totalClientsResult = await executeQuery(totalClientsQuery);
    const totalClients = totalClientsResult[0].total;

    // Chiffre d'affaires estimé (somme des prix des services pour les rendez-vous confirmés)
    const revenueQuery = `
      SELECT COALESCE(SUM(s.price), 0) as revenue
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE a.status IN ('confirmed', 'completed')
    `;
    const revenueResult = await executeQuery(revenueQuery);
    const revenue = parseFloat(revenueResult[0].revenue) || 0;

    // Réservations récentes (5 dernières)
    const recentBookingsQuery = `
      SELECT 
        a.id,
        a.start_datetime,
        a.status,
        s.name as service_name,
        CONCAT(uc.first_name, ' ', uc.last_name) as client_name,
        CONCAT(ue.first_name, ' ', ue.last_name) as employee_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN users uc ON uc.id = a.client_user_id
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users ue ON ue.id = e.user_id
      ORDER BY a.start_datetime DESC
      LIMIT 5
    `;
    const recentBookings = await executeQuery(recentBookingsQuery);

    res.json({
      totalBookings,
      totalServices,
      totalEmployees,
      totalClients,
      pendingBookings,
      confirmedBookings,
      todayBookings,
      revenue,
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        client_name: booking.client_name,
        service_name: booking.service_name,
        employee_name: booking.employee_name,
        start_datetime: booking.start_datetime,
        status: booking.status
      }))
    });
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des statistiques' });
  }
});

module.exports = router;

