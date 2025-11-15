const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery } = require('../config/database');

const router = express.Router();

// GET /api/reports - Générer un rapport complet
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query; // 7, 30, 90, 365 jours
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Chiffre d'affaires total
    const revenueQuery = `
      SELECT COALESCE(SUM(s.price), 0) as total_revenue
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE a.status IN ('confirmed', 'completed')
        AND DATE(a.start_datetime) >= ?
    `;
    const revenueResult = await executeQuery(revenueQuery, [startDateStr]);
    const totalRevenue = parseFloat(revenueResult[0].total_revenue) || 0;

    // Total des rendez-vous
    const appointmentsQuery = `
      SELECT COUNT(*) as total
      FROM appointments
      WHERE DATE(start_datetime) >= ?
    `;
    const appointmentsResult = await executeQuery(appointmentsQuery, [startDateStr]);
    const totalAppointments = appointmentsResult[0].total;

    // Valeur moyenne par rendez-vous
    const averageValue = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

    // Top 5 services
    const topServicesQuery = `
      SELECT 
        s.name,
        COUNT(a.id) as appointments_count,
        COALESCE(SUM(s.price), 0) as revenue
      FROM services s
      LEFT JOIN appointments a ON a.service_id = s.id 
        AND a.status IN ('confirmed', 'completed')
        AND DATE(a.start_datetime) >= ?
      WHERE s.is_active = 1
      GROUP BY s.id, s.name
      ORDER BY revenue DESC, appointments_count DESC
      LIMIT 5
    `;
    const topServices = await executeQuery(topServicesQuery, [startDateStr]);

    // Distribution des statuts
    const statusDistributionQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM appointments
      WHERE DATE(start_datetime) >= ?
      GROUP BY status
    `;
    const statusDistribution = await executeQuery(statusDistributionQuery, [startDateStr]);
    const totalForStatus = statusDistribution.reduce((sum, s) => sum + s.count, 0);
    const statusDistributionWithPercent = statusDistribution.map(s => ({
      status: s.status === 'pending' ? 'En attente' : 
               s.status === 'confirmed' ? 'Confirmé' :
               s.status === 'completed' ? 'Terminé' :
               s.status === 'cancelled' ? 'Annulé' : s.status,
      count: s.count,
      percentage: totalForStatus > 0 ? Math.round((s.count / totalForStatus) * 100) : 0
    }));

    // Données mensuelles (6 derniers mois)
    const monthlyDataQuery = `
      SELECT 
        DATE_FORMAT(start_datetime, '%Y-%m') as month,
        DATE_FORMAT(start_datetime, '%M %Y') as month_label,
        COUNT(*) as appointments,
        COALESCE(SUM(s.price), 0) as revenue
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.start_datetime >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        AND a.status IN ('confirmed', 'completed')
      GROUP BY DATE_FORMAT(start_datetime, '%Y-%m'), DATE_FORMAT(start_datetime, '%M %Y')
      ORDER BY month DESC
      LIMIT 6
    `;
    const monthlyData = await executeQuery(monthlyDataQuery);

    // Statistiques clients
    const clientStatsQuery = `
      SELECT 
        COUNT(DISTINCT a.client_user_id) as total_clients,
        COUNT(DISTINCT CASE 
          WHEN a.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
          THEN a.client_user_id 
        END) as new_clients
      FROM appointments a
      WHERE DATE(a.start_datetime) >= ?
    `;
    const clientStatsResult = await executeQuery(clientStatsQuery, [days, startDateStr]);
    const clientStats = {
      totalClients: clientStatsResult[0].total_clients || 0,
      newClients: clientStatsResult[0].new_clients || 0,
      returningClients: (clientStatsResult[0].total_clients || 0) - (clientStatsResult[0].new_clients || 0)
    };

    res.json({
      totalRevenue,
      totalAppointments,
      averageAppointmentValue: averageValue,
      topServices: topServices.map(s => ({
        name: s.name,
        appointments: s.appointments_count || 0,
        revenue: parseFloat(s.revenue) || 0
      })),
      statusDistribution: statusDistributionWithPercent,
      monthlyData: monthlyData.map(m => ({
        month: m.month_label,
        appointments: m.appointments,
        revenue: parseFloat(m.revenue) || 0
      })),
      clientStats
    });
  } catch (error) {
    console.error('Erreur génération rapport:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la génération du rapport' });
  }
});

module.exports = router;

