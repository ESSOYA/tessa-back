const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery } = require('../config/database');

const router = express.Router();

// GET /api/site-settings/:key - Récupérer un paramètre (public pour certaines clés)
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // Certaines clés sont publiques (accessibles sans authentification)
    const publicKeys = ['homepage_background_image'];
    const isPublic = publicKeys.includes(key);
    
    // Si ce n'est pas une clé publique, vérifier l'authentification admin
    if (!isPublic) {
      // Vérifier le token si présent, mais ne pas bloquer si absent
      // (pour permettre l'accès public aux clés publiques)
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          // Vérifier que c'est un admin
          if (decoded.role_id !== 2) {
            return res.status(403).json({ error: 'Accès refusé' });
          }
        } else {
          return res.status(401).json({ error: 'Authentification requise' });
        }
      } catch (authError) {
        return res.status(401).json({ error: 'Token invalide' });
      }
    }
    
    const query = 'SELECT setting_value FROM site_settings WHERE setting_key = ?';
    const results = await executeQuery(query, [key]);
    
    if (results.length === 0) {
      // Pour les clés publiques, retourner null au lieu de 404
      if (isPublic) {
        return res.json({ value: null });
      }
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    
    res.json({ value: results[0].setting_value });
  } catch (error) {
    console.error('Erreur récupération paramètre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/site-settings - Récupérer tous les paramètres (admin seulement)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = 'SELECT setting_key, setting_value FROM site_settings';
    const results = await executeQuery(query);
    
    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    res.json({ settings });
  } catch (error) {
    console.error('Erreur récupération paramètres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/site-settings/:key - Mettre à jour un paramètre
router.put('/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Valeur requise' });
    }
    
    const query = `
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `;
    
    await executeQuery(query, [key, value]);
    
    res.json({ success: true, message: 'Paramètre mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur mise à jour paramètre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

