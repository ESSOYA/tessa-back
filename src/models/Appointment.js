const { executeQuery, executeTransaction } = require('../config/database');
const moment = require('moment');

class Appointment {
  constructor(data) {
    this.id = data.id;
    this.client_user_id = data.client_user_id;
    this.employee_id = data.employee_id;
    this.service_id = data.service_id;
    this.start_datetime = data.start_datetime;
    this.end_datetime = data.end_datetime;
    this.status = data.status;
    this.notes = data.notes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    
    // Données jointes depuis les autres tables
    this.service_name = data.service_name || null;
    this.client_name = data.client_name || null;
    this.client_email = data.client_email || null;
    this.client_phone = data.client_phone || null;
    this.employee_name = data.employee_name || null;
  }

  // Créer un nouveau rendez-vous
  static async create(appointmentData) {
    const {
      client_user_id,
      service_id,
      start_datetime,
      employee_id = null,
      notes = null
    } = appointmentData;

    // Récupérer la durée du service
    const serviceQuery = 'SELECT duration_minutes FROM services WHERE id = ?';
    const serviceResults = await executeQuery(serviceQuery, [service_id]);
    
    if (serviceResults.length === 0) {
      throw new Error('Service introuvable');
    }

    const duration = serviceResults[0].duration_minutes;
    const end_datetime = moment(start_datetime).add(duration, 'minutes').format('YYYY-MM-DD HH:mm:ss');

    // Vérifier les conflits si un employé est assigné
    if (employee_id) {
      await this.checkEmployeeConflict(employee_id, start_datetime, end_datetime);
    }

    const queries = [
      {
        query: `
          INSERT INTO appointments (client_user_id, employee_id, service_id, start_datetime, end_datetime, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          client_user_id,
          employee_id,
          service_id,
          start_datetime,
          end_datetime,
          notes,
          employee_id ? 'confirmed' : 'pending'
        ]
      },
      {
        query: `
          INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
          VALUES (LAST_INSERT_ID(), ?, 'email', 'Confirmation de rendez-vous', ?, NOW(), 'pending')
        `,
        params: [
          client_user_id,
          `Votre rendez-vous a été confirmé pour le ${moment(start_datetime).format('DD/MM/YYYY à HH:mm')}`
        ]
      }
    ];

    const results = await executeTransaction(queries);
    return results[0].insertId;
  }

  // Vérifier les conflits d'horaires pour un employé
  static async checkEmployeeConflict(employee_id, start_datetime, end_datetime, exclude_appointment_id = null) {
    let query = `
      SELECT COUNT(*) as conflict_count
      FROM appointments
      WHERE employee_id = ?
        AND status IN ('pending', 'confirmed')
        AND NOT (end_datetime <= ? OR start_datetime >= ?)
    `;
    
    let params = [employee_id, start_datetime, end_datetime];
    
    if (exclude_appointment_id) {
      query += ' AND id != ?';
      params.push(exclude_appointment_id);
    }
    
    const results = await executeQuery(query, params);
    
    if (results[0].conflict_count > 0) {
      throw new Error('L\'employé a déjà un rendez-vous sur cette plage horaire');
    }
  }

  // Trouver un rendez-vous par ID
  static async findById(id) {
    const query = `
      SELECT a.*, 
             s.name as service_name, s.duration_minutes, s.price,
             CONCAT(uc.first_name, ' ', uc.last_name) as client_name, uc.email as client_email, uc.phone as client_phone,
             CONCAT(ue.first_name, ' ', ue.last_name) as employee_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN users uc ON uc.id = a.client_user_id
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users ue ON ue.id = e.user_id
      WHERE a.id = ?
    `;
    
    const results = await executeQuery(query, [id]);
    return results.length > 0 ? new Appointment(results[0]) : null;
  }

  // Obtenir tous les rendez-vous avec filtres
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 10,
      status = null,
      employee_id = null,
      client_id = null,
      date_from = null,
      date_to = null
    } = filters;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    if (employee_id) {
      whereClause += ' AND a.employee_id = ?';
      params.push(employee_id);
    }

    if (client_id) {
      whereClause += ' AND a.client_user_id = ?';
      params.push(client_id);
    }

    if (date_from) {
      whereClause += ' AND DATE(a.start_datetime) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND DATE(a.start_datetime) <= ?';
      params.push(date_to);
    }

    const query = `
      SELECT a.*, 
             s.name as service_name, s.duration_minutes, s.price,
             CONCAT(uc.first_name, ' ', uc.last_name) as client_name, uc.email as client_email, uc.phone as client_phone,
             CONCAT(ue.first_name, ' ', ue.last_name) as employee_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN users uc ON uc.id = a.client_user_id
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users ue ON ue.id = e.user_id
      ${whereClause}
      ORDER BY a.start_datetime DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const results = await executeQuery(query, params);
    return results.map(appointment => new Appointment(appointment));
  }

  // Mettre à jour le statut d'un rendez-vous
  async updateStatus(new_status, changed_by = null, reason = null) {
    const old_status = this.status;
    
    const queries = [
      {
        query: 'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [new_status, this.id]
      },
      {
        query: `
          INSERT INTO appointment_history (appointment_id, action, old_value, new_value, changed_by)
          VALUES (?, 'status_changed', ?, ?, ?)
        `,
        params: [this.id, old_status, new_status, changed_by]
      }
    ];

    // Ajouter une notification selon le statut
    let notificationSubject, notificationBody;
    
    switch (new_status) {
      case 'confirmed':
        notificationSubject = 'Rendez-vous confirmé';
        notificationBody = `Votre rendez-vous du ${moment(this.start_datetime).format('DD/MM/YYYY à HH:mm')} a été confirmé.`;
        break;
      case 'cancelled':
        notificationSubject = 'Rendez-vous annulé';
        notificationBody = `Votre rendez-vous du ${moment(this.start_datetime).format('DD/MM/YYYY à HH:mm')} a été annulé.${reason ? ' Raison: ' + reason : ''}`;
        break;
      case 'completed':
        notificationSubject = 'Rendez-vous terminé';
        notificationBody = `Votre rendez-vous du ${moment(this.start_datetime).format('DD/MM/YYYY à HH:mm')} a été marqué comme terminé.`;
        break;
    }

    if (notificationSubject) {
      queries.push({
        query: `
          INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
          VALUES (?, ?, 'email', ?, ?, NOW(), 'pending')
        `,
        params: [this.id, this.client_user_id, notificationSubject, notificationBody]
      });
    }

    await executeTransaction(queries);
    this.status = new_status;
    return true;
  }

  // Assigner automatiquement un employé
  async assignAutoEmployee() {
    const query = 'CALL assign_auto_employee(?)';
    await executeQuery(query, [this.id]);
    
    // Récupérer les données mises à jour
    const updated = await Appointment.findById(this.id);
    if (updated) {
      Object.assign(this, updated);
    }
    
    return true;
  }

  // Annuler un rendez-vous
  async cancel(cancelled_by = null, reason = null) {
    const query = 'CALL cancel_appointment(?, ?, ?)';
    await executeQuery(query, [this.id, cancelled_by, reason]);
    this.status = 'cancelled';
    return true;
  }

  // Obtenir l'historique d'un rendez-vous
  async getHistory() {
    const query = `
      SELECT ah.*, CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
      FROM appointment_history ah
      LEFT JOIN users u ON u.id = ah.changed_by
      WHERE ah.appointment_id = ?
      ORDER BY ah.changed_at DESC
    `;
    
    return await executeQuery(query, [this.id]);
  }

  // Obtenir les disponibilités pour une date et un service
  static async getAvailableSlots(date, service_id, employee_id = null) {
    const serviceQuery = 'SELECT duration_minutes FROM services WHERE id = ?';
    const serviceResults = await executeQuery(serviceQuery, [service_id]);
    
    if (serviceResults.length === 0) {
      throw new Error('Service introuvable');
    }

    const duration = serviceResults[0].duration_minutes;
    
    // Heures d'ouverture du salon (9h-18h)
    const startHour = 9;
    const endHour = 18;
    const slotDuration = 30; // Créneaux de 30 minutes
    
    const availableSlots = [];
    
    for (let hour = startHour; hour < endHour; hour += 0.5) {
      const slotStart = moment(date).hour(Math.floor(hour)).minute((hour % 1) * 60);
      const slotEnd = slotStart.clone().add(duration, 'minutes');
      
      // Vérifier si le créneau est disponible
      const conflictQuery = `
        SELECT COUNT(*) as count
        FROM appointments
        WHERE DATE(start_datetime) = ?
          AND status IN ('pending', 'confirmed')
          AND NOT (end_datetime <= ? OR start_datetime >= ?)
          ${employee_id ? 'AND employee_id = ?' : ''}
      `;
      
      const params = [date, slotStart.format('YYYY-MM-DD HH:mm:ss'), slotEnd.format('YYYY-MM-DD HH:mm:ss')];
      if (employee_id) params.push(employee_id);
      
      const results = await executeQuery(conflictQuery, params);
      
      if (results[0].count === 0) {
        availableSlots.push({
          start: slotStart.format('YYYY-MM-DD HH:mm:ss'),
          end: slotEnd.format('YYYY-MM-DD HH:mm:ss')
        });
      }
    }
    
    return availableSlots;
  }

  // Obtenir les données publiques
  toPublicJSON() {
    return {
      id: this.id,
      service_id: this.service_id,
      service_name: this.service_name,
      client_name: this.client_name,
      client_email: this.client_email,
      client_phone: this.client_phone,
      employee_name: this.employee_name,
      start_datetime: this.start_datetime,
      end_datetime: this.end_datetime,
      status: this.status,
      notes: this.notes,
      created_at: this.created_at
    };
  }
}

module.exports = Appointment;

