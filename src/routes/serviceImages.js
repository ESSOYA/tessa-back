const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery } = require('../config/database');

const router = express.Router();

// Configuration de multer pour l'upload de fichiers
// Pour simplifier, on stocke les URLs. En production, vous devriez uploader les fichiers
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// GET /api/service-images/:serviceId - Récupérer toutes les images d'un service
router.get('/:serviceId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    const query = `
      SELECT id, service_id, image_url, image_order, is_primary, created_at
      FROM service_images
      WHERE service_id = ?
      ORDER BY image_order ASC, created_at ASC
    `;
    
    const images = await executeQuery(query, [serviceId]);
    
    res.json({ images });
  } catch (error) {
    console.error('Erreur récupération images service:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des images' });
  }
});

// POST /api/service-images/:serviceId - Ajouter une image à un service
router.post('/:serviceId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { image_url, is_primary } = req.body;
    
    if (!image_url) {
      return res.status(400).json({ error: 'URL de l\'image requise' });
    }
    
    // Vérifier que le service existe
    const serviceCheck = await executeQuery('SELECT id FROM services WHERE id = ?', [serviceId]);
    if (serviceCheck.length === 0) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }
    
    // Si c'est l'image principale, désactiver les autres
    if (is_primary) {
      await executeQuery(
        'UPDATE service_images SET is_primary = 0 WHERE service_id = ?',
        [serviceId]
      );
    }
    
    // Récupérer le prochain ordre
    const orderQuery = await executeQuery(
      'SELECT MAX(image_order) as max_order FROM service_images WHERE service_id = ?',
      [serviceId]
    );
    const nextOrder = (orderQuery[0]?.max_order || 0) + 1;
    
    // Insérer l'image
    const insertQuery = `
      INSERT INTO service_images (service_id, image_url, image_order, is_primary)
      VALUES (?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      serviceId,
      image_url,
      nextOrder,
      is_primary ? 1 : 0
    ]);
    
    res.json({
      success: true,
      image: {
        id: result.insertId,
        service_id: parseInt(serviceId),
        image_url,
        image_order: nextOrder,
        is_primary: is_primary ? 1 : 0
      }
    });
  } catch (error) {
    console.error('Erreur ajout image service:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de l\'image' });
  }
});

// PUT /api/service-images/:imageId - Modifier une image
router.put('/:imageId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { image_url, is_primary, image_order } = req.body;
    
    // Récupérer l'image actuelle
    const currentImage = await executeQuery(
      'SELECT service_id, is_primary FROM service_images WHERE id = ?',
      [imageId]
    );
    
    if (currentImage.length === 0) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    const serviceId = currentImage[0].service_id;
    
    // Si on définit cette image comme principale, désactiver les autres
    if (is_primary) {
      await executeQuery(
        'UPDATE service_images SET is_primary = 0 WHERE service_id = ? AND id != ?',
        [serviceId, imageId]
      );
    }
    
    // Mettre à jour l'image
    const updates = [];
    const values = [];
    
    if (image_url !== undefined) {
      updates.push('image_url = ?');
      values.push(image_url);
    }
    
    if (is_primary !== undefined) {
      updates.push('is_primary = ?');
      values.push(is_primary ? 1 : 0);
    }
    
    if (image_order !== undefined) {
      updates.push('image_order = ?');
      values.push(image_order);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification à apporter' });
    }
    
    values.push(imageId);
    const updateQuery = `UPDATE service_images SET ${updates.join(', ')} WHERE id = ?`;
    
    await executeQuery(updateQuery, values);
    
    // Récupérer l'image mise à jour
    const updatedImage = await executeQuery(
      'SELECT * FROM service_images WHERE id = ?',
      [imageId]
    );
    
    res.json({ success: true, image: updatedImage[0] });
  } catch (error) {
    console.error('Erreur modification image service:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la modification de l\'image' });
  }
});

// DELETE /api/service-images/:imageId - Supprimer une image
router.delete('/:imageId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Vérifier que l'image existe
    const image = await executeQuery('SELECT * FROM service_images WHERE id = ?', [imageId]);
    
    if (image.length === 0) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    // Supprimer l'image
    await executeQuery('DELETE FROM service_images WHERE id = ?', [imageId]);
    
    res.json({ success: true, message: 'Image supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression image service:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'image' });
  }
});

module.exports = router;

