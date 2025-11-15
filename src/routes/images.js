const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// GET /api/images/:path(*) - Servir une image depuis le dossier public
// Format: /api/images/public/Service Name/filename.jpg
router.get('/*', (req, res) => {
  try {
    // Récupérer le chemin complet après /api/images/
    const imagePath = req.params[0];
    
    // Le chemin doit commencer par "public/"
    if (!imagePath.startsWith('public/')) {
      return res.status(400).json({ error: 'Chemin invalide. Doit commencer par public/' });
    }
    
    // Construire le chemin complet du fichier
    const fullPath = path.join(__dirname, '../../', imagePath);
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(fullPath)) {
      console.error(`Image non trouvée: ${fullPath}`);
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    
    // Vérifier que c'est bien un fichier image
    const ext = path.extname(fullPath).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Type de fichier non autorisé' });
    }
    
    // Définir le type MIME
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    // Headers CORS
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
    
    // Envoyer le fichier
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    console.error('Erreur serveur image:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

