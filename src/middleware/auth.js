const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    return res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

// Middleware pour vérifier les rôles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const userRole = req.user.role_name;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Accès refusé',
        required_roles: allowedRoles,
        user_role: userRole
      });
    }

    next();
  };
};

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = requireRole('admin');

// Middleware pour vérifier si l'utilisateur est admin ou manager
const requireAdminOrManager = requireRole(['admin', 'manager']);

// Middleware pour vérifier si l'utilisateur est employé ou plus
const requireEmployee = requireRole(['admin', 'manager', 'coiffeur']);

// Middleware optionnel (ne bloque pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // En cas d'erreur, on continue sans authentification
    next();
  }
};

// Middleware pour vérifier la propriété des ressources
const checkResourceOwnership = (resourceUserIdField = 'client_user_id') => {
  return (req, res, next) => {
    // Les admins peuvent accéder à tout
    if (req.user.role_name === 'admin') {
      return next();
    }

    // Vérifier si l'utilisateur est le propriétaire de la ressource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (resourceUserId && parseInt(resourceUserId) === req.user.id) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Accès refusé - Vous ne pouvez accéder qu\'à vos propres ressources' 
    });
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireAdminOrManager,
  requireEmployee,
  optionalAuth,
  checkResourceOwnership
};

