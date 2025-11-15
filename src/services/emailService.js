const nodemailer = require('nodemailer');
const { executeQuery } = require('../config/database');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // En mode développement, désactiver l'envoi d'emails
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Service email désactivé en mode développement');
        this.transporter = null;
        return;
      }

      // En production, utiliser SendGrid
      if (process.env.SENDGRID_API_KEY) {
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        await this.transporter.verify();
        console.log('✅ Service email SendGrid configuré avec succès');
        return;
      }

      // Fallback: Ethereal Email pour les tests
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      });

      await this.transporter.verify();
      console.log('✅ Service email Ethereal configuré avec succès');
    } catch (error) {
      console.error('❌ Erreur configuration email:', error.message);
      console.log('📧 Service email désactivé - les emails ne seront pas envoyés');
      this.transporter = null;
    }
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      // Si le transporter n'est pas configuré, simuler l'envoi
      if (!this.transporter) {
        console.log(`📧 [SIMULATION] Email à ${to}: ${subject}`);
        return { messageId: 'simulated-' + Date.now() };
      }

      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'TESSA COIFFURE',
          address: process.env.EMAIL_FROM || 'noreply@tessa-coiffure.com'
        },
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email envoyé:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }

  // Email de confirmation de rendez-vous
  async sendAppointmentConfirmation(appointment) {
    const { client_email, client_name, service_name, start_datetime, employee_name } = appointment;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmation de rendez-vous</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
          .content { padding: 20px 0; }
          .appointment-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Rendez-vous confirmé !</h1>
          </div>
          
          <div class="content">
            <p>Bonjour ${client_name},</p>
            
            <p>Votre rendez-vous a été confirmé avec succès !</p>
            
            <div class="appointment-details">
              <h3>Détails du rendez-vous :</h3>
              <p><strong>Service :</strong> ${service_name}</p>
              <p><strong>Date et heure :</strong> ${this.formatDateTime(start_datetime)}</p>
              ${employee_name ? `<p><strong>Coiffeur :</strong> ${employee_name}</p>` : ''}
            </div>
            
            <p>Nous vous attendons avec impatience !</p>
            
            <p>Si vous avez des questions ou souhaitez modifier votre rendez-vous, n'hésitez pas à nous contacter.</p>
          </div>
          
          <div class="footer">
            <p>TESSA COIFFURE - Votre beauté, notre passion</p>
            <p>📞 01 23 45 67 89 | 📧 contact@tessa-coiffure.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(client_email, 'Confirmation de rendez-vous', html);
  }

  // Email de rappel de rendez-vous
  async sendAppointmentReminder(appointment) {
    const { client_email, client_name, service_name, start_datetime, employee_name } = appointment;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rappel de rendez-vous</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fff3cd; padding: 20px; text-align: center; border-radius: 8px; border: 1px solid #ffeaa7; }
          .content { padding: 20px 0; }
          .appointment-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Rappel de rendez-vous</h1>
          </div>
          
          <div class="content">
            <p>Bonjour ${client_name},</p>
            
            <p>Nous vous rappelons que vous avez un rendez-vous demain !</p>
            
            <div class="appointment-details">
              <h3>Détails du rendez-vous :</h3>
              <p><strong>Service :</strong> ${service_name}</p>
              <p><strong>Date et heure :</strong> ${this.formatDateTime(start_datetime)}</p>
              ${employee_name ? `<p><strong>Coiffeur :</strong> ${employee_name}</p>` : ''}
            </div>
            
            <p>Nous vous attendons avec plaisir !</p>
            
            <p><strong>Conseil :</strong> Arrivez 5 minutes en avance pour profiter pleinement de votre moment de détente.</p>
          </div>
          
          <div class="footer">
            <p>TESSA COIFFURE - Votre beauté, notre passion</p>
            <p>📞 01 23 45 67 89 | 📧 contact@tessa-coiffure.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(client_email, 'Rappel de rendez-vous', html);
  }

  // Email d'annulation de rendez-vous
  async sendAppointmentCancellation(appointment, reason = null) {
    const { client_email, client_name, service_name, start_datetime } = appointment;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Annulation de rendez-vous</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8d7da; padding: 20px; text-align: center; border-radius: 8px; border: 1px solid #f5c6cb; }
          .content { padding: 20px 0; }
          .appointment-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Rendez-vous annulé</h1>
          </div>
          
          <div class="content">
            <p>Bonjour ${client_name},</p>
            
            <p>Votre rendez-vous a été annulé.</p>
            
            <div class="appointment-details">
              <h3>Rendez-vous annulé :</h3>
              <p><strong>Service :</strong> ${service_name}</p>
              <p><strong>Date et heure :</strong> ${this.formatDateTime(start_datetime)}</p>
              ${reason ? `<p><strong>Raison :</strong> ${reason}</p>` : ''}
            </div>
            
            <p>Nous sommes désolés pour ce désagrément.</p>
            <p>N'hésitez pas à prendre un nouveau rendez-vous quand vous le souhaiterez.</p>
          </div>
          
          <div class="footer">
            <p>TESSA COIFFURE - Votre beauté, notre passion</p>
            <p>📞 01 23 45 67 89 | 📧 contact@tessa-coiffure.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(client_email, 'Annulation de rendez-vous', html);
  }

  // Traitement des notifications en attente
  async processPendingNotifications() {
    try {
      const query = `
        SELECT n.*, a.client_user_id, u.email as client_email, u.first_name, u.last_name,
               s.name as service_name, a.start_datetime, a.end_datetime,
               CONCAT(ue.first_name, ' ', ue.last_name) as employee_name
        FROM notifications n
        LEFT JOIN appointments a ON a.id = n.appointment_id
        LEFT JOIN users u ON u.id = n.user_id
        LEFT JOIN services s ON s.id = a.service_id
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN users ue ON ue.id = e.user_id
        WHERE n.status = 'pending' 
          AND (n.scheduled_at IS NULL OR n.scheduled_at <= NOW())
        ORDER BY n.created_at ASC
        LIMIT 10
      `;

      const notifications = await executeQuery(query);

      for (const notification of notifications) {
        try {
          let emailSent = false;

          switch (notification.subject) {
            case 'Confirmation de rendez-vous':
              await this.sendAppointmentConfirmation({
                client_email: notification.client_email,
                client_name: `${notification.first_name} ${notification.last_name}`,
                service_name: notification.service_name,
                start_datetime: notification.start_datetime,
                employee_name: notification.employee_name
              });
              emailSent = true;
              break;

            case 'Rappel de rendez-vous':
              await this.sendAppointmentReminder({
                client_email: notification.client_email,
                client_name: `${notification.first_name} ${notification.last_name}`,
                service_name: notification.service_name,
                start_datetime: notification.start_datetime,
                employee_name: notification.employee_name
              });
              emailSent = true;
              break;

            case 'Rendez-vous annulé':
              await this.sendAppointmentCancellation({
                client_email: notification.client_email,
                client_name: `${notification.first_name} ${notification.last_name}`,
                service_name: notification.service_name,
                start_datetime: notification.start_datetime
              }, notification.body);
              emailSent = true;
              break;

            default:
              // Email générique
              await this.sendEmail(
                notification.client_email,
                notification.subject,
                `<p>${notification.body}</p>`
              );
              emailSent = true;
          }

          if (emailSent) {
            // Marquer comme envoyé
            await executeQuery(
              'UPDATE notifications SET status = "sent", sent_at = NOW() WHERE id = ?',
              [notification.id]
            );
          }

        } catch (error) {
          console.error(`Erreur envoi notification ${notification.id}:`, error);
          
          // Incrémenter le nombre de tentatives
          await executeQuery(
            'UPDATE notifications SET attempts = attempts + 1 WHERE id = ?',
            [notification.id]
          );

          // Marquer comme échoué après 3 tentatives
          const updateQuery = `
            UPDATE notifications 
            SET status = CASE WHEN attempts >= 2 THEN 'failed' ELSE 'pending' END
            WHERE id = ?
          `;
          await executeQuery(updateQuery, [notification.id]);
        }
      }

      console.log(`📧 Traitement de ${notifications.length} notifications terminé`);
    } catch (error) {
      console.error('❌ Erreur traitement notifications:', error);
    }
  }

  // Programmer un rappel automatique
  async scheduleReminder(appointmentId, reminderMinutes = 1440) {
    const scheduledAt = new Date();
    scheduledAt.setMinutes(scheduledAt.getMinutes() + reminderMinutes);

    const query = `
      INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
      SELECT a.id, a.client_user_id, 'email', 'Rappel de rendez-vous', 
             CONCAT('Rappel: votre rendez-vous est prévu le ', DATE_FORMAT(a.start_datetime, '%d/%m/%Y à %H:%i')),
             ?, 'pending'
      FROM appointments a
      WHERE a.id = ?
    `;

    await executeQuery(query, [scheduledAt, appointmentId]);
  }

  // Utilitaires
  formatDateTime(datetime) {
    const date = new Date(datetime);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  htmlToText(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();