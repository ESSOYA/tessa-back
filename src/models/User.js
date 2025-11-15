const { executeQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    // Convertir role_id en nombre, avec fallback si null/undefined
    this.role_id = data.role_id != null ? parseInt(data.role_id, 10) : null;
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.phone = data.phone;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.role_name = data.role_name; // Ajouter role_name depuis le JOIN
  }

  // Créer un nouvel utilisateur
  static async create(userData) {
    const { role_id, email, password, first_name, last_name, phone } = userData;
    
    // Hacher le mot de passe
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Gérer les valeurs undefined/null
    const phoneValue = phone || null;
    
    const query = `
      INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(query, [
      role_id, email, password_hash, first_name, last_name, phoneValue
    ]);
    
    return result.insertId;
  }

  // Trouver un utilisateur par email
  static async findByEmail(email) {
    const query = `
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON r.id = u.role_id 
      WHERE u.email = ? AND u.is_active = 1
    `;
    
    const results = await executeQuery(query, [email]);
    return results.length > 0 ? new User(results[0]) : null;
  }

  // Trouver un utilisateur par ID
  static async findById(id) {
    const query = `
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON r.id = u.role_id 
      WHERE u.id = ? AND u.is_active = 1
    `;
    
    const results = await executeQuery(query, [id]);
    return results.length > 0 ? new User(results[0]) : null;
  }

  // Vérifier le mot de passe
  async checkPassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  // Mettre à jour le profil utilisateur
  async update(updateData) {
    const allowedFields = ['first_name', 'last_name', 'phone'];
    const updates = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length === 0) return false;
    
    values.push(this.id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    await executeQuery(query, values);
    return true;
  }

  // Désactiver un utilisateur
  async deactivate() {
    const query = 'UPDATE users SET is_active = 0 WHERE id = ?';
    await executeQuery(query, [this.id]);
    return true;
  }

  // Obtenir tous les utilisateurs avec pagination
  static async findAll(page = 1, limit = 10, role = null) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE u.is_active = 1';
    let params = [];
    
    if (role) {
      whereClause += ' AND r.name = ?';
      params.push(role);
    }
    
    const query = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, 
             u.created_at, r.name as role_name
      FROM users u 
      JOIN roles r ON r.id = u.role_id 
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    return await executeQuery(query, params);
  }

  // Compter le total d'utilisateurs
  static async count(role = null) {
    let whereClause = 'WHERE u.is_active = 1';
    let params = [];
    
    if (role) {
      whereClause += ' AND r.name = ?';
      params.push(role);
    }
    
    const query = `
      SELECT COUNT(*) as total 
      FROM users u 
      JOIN roles r ON r.id = u.role_id 
      ${whereClause}
    `;
    
    const results = await executeQuery(query, params);
    return results[0].total;
  }

  // Obtenir les données publiques (sans mot de passe)
  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      first_name: this.first_name,
      last_name: this.last_name,
      phone: this.phone,
      role_name: this.role_name,
      created_at: this.created_at
    };
  }
}

module.exports = User;
