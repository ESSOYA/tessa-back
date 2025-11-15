const cron = require('node-cron');
const emailService = require('../services/emailService');
const { executeQuery } = require('../config/database');

class NotificationCron {
  constructor() {
    this.isRunning = false;
  }

  // Démarrer le traitement des notifications
  start() {
    // Traitement des notifications toutes les 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      if (!this.isRunning) {
        this.isRunning = true;
        try {
          await emailService.processPendingNotifications();
        } catch (error) {
          console.error('❌ Erreur cron notifications:', error);
        } finally {
          this.isRunning = false;
        }
      }
    });

    // Rappels automatiques quotidien à 9h
    cron.schedule('0 9 * * *', async () => {
      try {
        await this.scheduleDailyReminders();
      } catch (error) {
        console.error('❌ Erreur cron rappels:', error);
      }
    });

    // Nettoyage des anciennes notifications (quotidien à 2h)
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.cleanupOldNotifications();
      } catch (error) {
        console.error('❌ Erreur cron nettoyage:', error);
      }
    });

    console.log('✅ Cron jobs démarrés');
  }

  // Programmer les rappels pour le lendemain
  async scheduleDailyReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];

      // Récupérer les rendez-vous de demain
      const query = `
        SELECT a.id, a.client_user_id, a.start_datetime
        FROM appointments a
        WHERE DATE(a.start_datetime) = ?
          AND a.status IN ('pending', 'confirmed')
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.appointment_id = a.id
              AND n.subject = 'Rappel de rendez-vous'
              AND DATE(n.created_at) = CURDATE()
          )
      `;

      const appointments = await executeQuery(query, [tomorrowDate]);

      for (const appointment of appointments) {
        // Programmer le rappel pour 18h aujourd'hui
        const reminderTime = new Date();
        reminderTime.setHours(18, 0, 0, 0);

        const insertQuery = `
          INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
          VALUES (?, ?, 'email', 'Rappel de rendez-vous', 
                 CONCAT('Rappel: votre rendez-vous est prévu demain le ', DATE_FORMAT(?, '%d/%m/%Y à %H:%i')),
                 ?, 'pending')
        `;

        await executeQuery(insertQuery, [
          appointment.id,
          appointment.client_user_id,
          appointment.start_datetime,
          reminderTime
        ]);
      }

      console.log(`📅 ${appointments.length} rappels programmés pour demain`);
    } catch (error) {
      console.error('❌ Erreur programmation rappels:', error);
    }
  }

  // Nettoyer les anciennes notifications
  async cleanupOldNotifications() {
    try {
      // Supprimer les notifications envoyées de plus de 30 jours
      const deleteQuery = `
        DELETE FROM notifications 
        WHERE status = 'sent' 
          AND sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;

      const result = await executeQuery(deleteQuery);
      console.log(`🧹 ${result.affectedRows} anciennes notifications supprimées`);

      // Supprimer les notifications échouées de plus de 7 jours
      const deleteFailedQuery = `
        DELETE FROM notifications 
        WHERE status = 'failed' 
          AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
      `;

      const failedResult = await executeQuery(deleteFailedQuery);
      console.log(`🧹 ${failedResult.affectedRows} notifications échouées supprimées`);
    } catch (error) {
      console.error('❌ Erreur nettoyage notifications:', error);
    }
  }

  // Arrêter les cron jobs
  stop() {
    cron.getTasks().forEach(task => task.destroy());
    console.log('⏹️ Cron jobs arrêtés');
  }

  // Obtenir les statistiques des notifications
  async getStats() {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM notifications 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY status, DATE(created_at)
        ORDER BY date DESC, status
      `;

      const stats = await executeQuery(query);
      return stats;
    } catch (error) {
      console.error('❌ Erreur récupération stats notifications:', error);
      return [];
    }
  }
}

module.exports = new NotificationCron();

