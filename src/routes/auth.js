const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validate, authSchemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login - Connexion (pour les clients uniquement, role_id = 1)
router.post('/login', validate(authSchemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier que l'utilisateur est un client (role_id = 1)
    if (Number(user.role_id) !== 1) {
      return res.status(403).json({ error: 'Accès refusé. Cette route est réservée aux clients.' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.checkPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role_name 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name
      }
    });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// POST /api/auth/register - Inscription (pour les clients)
router.post('/register', validate(authSchemas.register), async (req, res) => {
  try {
    console.log('🔐 Tentative d\'inscription:', req.body);
    const { email, password, first_name, last_name, phone } = req.body;

    // Vérifier si l'utilisateur existe déjà
    console.log('🔍 Vérification de l\'existence de l\'utilisateur:', email);
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('❌ Utilisateur existe déjà');
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    // Utiliser role_id = 1 pour les clients
    const clientRoleId = 1;
    console.log('✅ Utilisation du role_id = 1 pour les clients');

    // Créer l'utilisateur
    console.log('👤 Création de l\'utilisateur...');
    const userId = await User.create({
      role_id: clientRoleId,
      email,
      password,
      first_name,
      last_name,
      phone
    });
    console.log('✅ Utilisateur créé avec l\'ID:', userId);

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId, 
        email, 
        role: 'client' 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        first_name,
        last_name,
        role: 'client'
      }
    });
  } catch (error) {
    console.error('❌ Erreur d\'inscription:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'inscription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/auth/me - Informations de l'utilisateur connecté
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user.toPublicJSON()
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/auth/profile - Mettre à jour le profil
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;
    
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    const success = await req.user.update(updateData);
    if (!success) {
      return res.status(400).json({ error: 'Erreur lors de la mise à jour' });
    }

    // Récupérer les données mises à jour
    const updatedUser = await User.findById(req.user.id);
    res.json({
      user: updatedUser.toPublicJSON()
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', authenticateToken, (req, res) => {
  // En JWT, la déconnexion se fait côté client en supprimant le token
  // Ici on peut ajouter une blacklist de tokens si nécessaire
  res.json({ message: 'Déconnexion réussie' });
});

// POST /api/auth/admin/login - Connexion admin (role_id = 2)
router.post('/admin/login', validate(authSchemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Tentative de connexion admin:', email);

    // Trouver l'utilisateur
    const user = await User.findByEmail(email);
    if (!user) {
      console.log('❌ Utilisateur non trouvé:', email);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    console.log('👤 Utilisateur trouvé:', {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_id_type: typeof user.role_id,
      role_name: user.role_name
    });

    // Vérifier que l'utilisateur est un admin (role_id = 2)
    // Utiliser == au lieu de === pour gérer les conversions de type
    if (Number(user.role_id) !== 2) {
      console.log('❌ Accès refusé - role_id:', user.role_id, 'type:', typeof user.role_id, 'attendu: 2');
      return res.status(403).json({ error: 'Accès refusé. Cette route est réservée aux administrateurs.' });
    }

    console.log('✅ Vérification role_id OK');

    // Vérifier le mot de passe
    const isPasswordValid = await user.checkPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role_name 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name
      }
    });
  } catch (error) {
    console.error('Erreur de connexion admin:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// GET /api/auth/admin/me - Informations de l'admin connecté
router.get('/admin/me', authenticateToken, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un admin (role_id = 2)
    if (Number(req.user.role_id) !== 2) {
      return res.status(403).json({ error: 'Accès refusé. Cette route est réservée aux administrateurs.' });
    }
    res.json({
      user: req.user.toPublicJSON()
    });
  } catch (error) {
    console.error('Erreur récupération profil admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/change-password - Changer le mot de passe
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await req.user.checkPassword(current_password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hacher le nouveau mot de passe
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Mettre à jour en base
    const { executeQuery } = require('../config/database');
    await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
