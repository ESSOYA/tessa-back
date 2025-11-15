const { executeQuery } = require('../config/database');

const fs = require('fs');
const path = require('path');

class Service {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.duration_minutes = data.duration_minutes;
    this.price = data.price;
    this.is_active = data.is_active;
    this.image = data.image || '';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Mapper le nom du service au nom du dossier
  static getServiceFolderName(serviceName) {
    const mapping = {
      'Coupe Femme': 'Coupe Femme',
      'coupe Homme': 'Coupe Homme',
      'Coupe Homme': 'Coupe Homme',
      'coloration': 'coloration',
      'Coloration': 'coloration',
      'Brushimg': 'brushing',
      'Brushing': 'brushing',
      'brushing': 'brushing',
      'Tresses': 'Tresses',
      'tresses': 'Tresses',
      'Soin Capillaire': 'Soin Capilaire', // Note: le dossier a une faute d'orthographe
      'soin capillaire': 'Soin Capilaire',
      'Soin capillaire': 'Soin Capilaire'
    };
    const folderName = mapping[serviceName] || serviceName;
    console.log(`Mapping service "${serviceName}" -> dossier "${folderName}"`);
    return folderName;
  }

  // Récupérer les images d'un service depuis le dossier public
  static getServiceImages(serviceName) {
    try {
      const folderName = this.getServiceFolderName(serviceName);
      const publicPath = path.join(__dirname, '../../public', folderName);
      
      console.log(`Recherche images pour "${serviceName}" dans: ${publicPath}`);
      
      if (!fs.existsSync(publicPath)) {
        console.warn(`Dossier non trouvé: ${publicPath}`);
        return [];
      }

      const files = fs.readdirSync(publicPath);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      const images = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return imageExtensions.includes(ext);
        })
        .map(file => {
          // Utiliser la route API pour servir les images (plus fiable pour CORS)
          const encodedServiceName = encodeURIComponent(serviceName);
          const encodedFile = encodeURIComponent(file);
          return `/api/images/service/${encodedServiceName}/${encodedFile}`;
        })
        .sort();

      console.log(`Images trouvées pour "${serviceName}": ${images.length}`);
      return images;
    } catch (error) {
      console.error(`Erreur récupération images pour ${serviceName}:`, error);
      return [];
    }
  }

  // Créer un nouveau service
  static async create(serviceData) {
    const { name, description, duration_minutes, price, image } = serviceData;
    
    const query = `
      INSERT INTO services (name, description, duration_minutes, price, image)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(query, [name, description, duration_minutes, price, image || '']);
    return result.insertId;
  }

  // Trouver un service par ID
  static async findById(id) {
    const query = 'SELECT * FROM services WHERE id = ?';
    const results = await executeQuery(query, [id]);
    return results.length > 0 ? new Service(results[0]) : null;
  }

  // Obtenir tous les services
  static async findAll(activeOnly = false) {
    const whereClause = activeOnly ? 'WHERE is_active = 1' : '';
    const query = `
      SELECT * FROM services 
      ${whereClause}
      ORDER BY name ASC
    `;
    
    const results = await executeQuery(query);
    return results.map(service => new Service(service));
  }

  // Obtenir les services avec pagination
  static async findWithPagination(page = 1, limit = 10, search = '', activeOnly = false) {
    const offset = (page - 1) * limit;
    let whereClause = activeOnly ? 'WHERE is_active = 1' : 'WHERE 1=1';
    let params = [];
    
    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const query = `
      SELECT * FROM services 
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const results = await executeQuery(query, params);
    return results.map(service => new Service(service));
  }

  // Mettre à jour un service
  async update(updateData) {
    const allowedFields = ['name', 'description', 'duration_minutes', 'price', 'is_active', 'image'];
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
    const query = `UPDATE services SET ${updates.join(', ')} WHERE id = ?`;
    
    await executeQuery(query, values);
    
    // Mettre à jour les propriétés de l'instance
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        this[key] = value;
      }
    }
    
    return true;
  }

  // Supprimer un service (soft delete)
  async delete() {
    const query = 'UPDATE services SET is_active = 0 WHERE id = ?';
    await executeQuery(query, [this.id]);
    return true;
  }

  // Vérifier si un service existe
  static async exists(id) {
    const query = 'SELECT COUNT(*) as count FROM services WHERE id = ? AND is_active = 1';
    const results = await executeQuery(query, [id]);
    return results[0].count > 0;
  }

  // Obtenir les statistiques d'un service
  async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
        AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate
      FROM appointments 
      WHERE service_id = ?
    `;
    
    const results = await executeQuery(query, [this.id]);
    return results[0];
  }

  // Compter le total de services
  static async count(search = '', activeOnly = false) {
    let whereClause = activeOnly ? 'WHERE is_active = 1' : 'WHERE 1=1';
    let params = [];
    
    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const query = `SELECT COUNT(*) as total FROM services ${whereClause}`;
    const results = await executeQuery(query, params);
    return results[0].total;
  }

  // Obtenir les données publiques
  toPublicJSON() {
    // Utiliser directement le champ image de la base de données
    // Si l'image est vide, essayer de récupérer depuis le dossier
    let imageUrl = this.image || '';
    let images = [];
    
    // Si pas d'image dans la DB, essayer de récupérer depuis le dossier
    if (!imageUrl) {
      images = Service.getServiceImages(this.name);
      imageUrl = images.length > 0 ? images[0] : '';
    } else {
      // Si on a une image dans la DB, construire la liste complète
      images = Service.getServiceImages(this.name);
      // Si on a une image principale dans la DB, la mettre en premier
      if (imageUrl && !images.includes(imageUrl)) {
        images = [imageUrl, ...images];
      }
    }
    
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      duration: this.duration_minutes,
      price: this.price,
      image: imageUrl,
      images: images,
      created_at: this.created_at
    };
  }
}

module.exports = Service;

