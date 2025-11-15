const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Configuration du rate limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Rate limiting général
const generalRateLimit = createRateLimit(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  'Trop de requêtes, veuillez réessayer plus tard'
);

// Rate limiting pour l'authentification
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 tentatives max
  'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes'
);

// Rate limiting pour les inscriptions
const registerRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 heure
  process.env.NODE_ENV === 'development' ? 50 : 3, // 50 en dev, 3 en prod
  'Trop d\'inscriptions, veuillez réessayer dans 1 heure'
);

// Rate limiting pour les rendez-vous
const appointmentRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 créations max par minute
  'Trop de réservations, veuillez ralentir'
);

// Configuration Helmet pour la sécurité
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:*", "http://127.0.0.1:*", "blob:", "*"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false // Désactiver pour permettre le chargement cross-origin
});

// Middleware de validation des headers
const validateHeaders = (req, res, next) => {
  // Ignorer la validation pour les fichiers statiques
  if (req.path.startsWith('/public/')) {
    return next();
  }

  // Vérifier le Content-Type pour les requêtes POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Content-Type doit être application/json'
      });
    }
  }

  // Vérifier la taille du body
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 1024 * 1024; // 1MB
  if (contentLength > maxSize) {
    return res.status(413).json({
      error: 'Taille de la requête trop importante'
    });
  }

  next();
};

// Middleware de validation de l'origine
const validateOrigin = (req, res, next) => {
  // Ignorer la validation pour les fichiers statiques
  if (req.path.startsWith('/public/')) {
    return next();
  }

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081'
  ].filter(Boolean);

  const origin = req.headers.origin;
  
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      error: 'Origine non autorisée'
    });
  }

  next();
};

// Middleware de logging des requêtes
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Log différent selon le statut
    if (res.statusCode >= 400) {
      console.error('❌', logData);
    } else {
      console.log('✅', logData);
    }
  });

  next();
};

// Middleware de gestion des erreurs
const errorHandler = (err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);

  // Erreurs de validation Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Erreurs MySQL
  if (err.code && err.code.startsWith('ER_')) {
    return res.status(400).json({
      error: 'Erreur de base de données',
      message: 'Veuillez vérifier vos données'
    });
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token invalide'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expiré'
    });
  }

  // Erreur générique
  res.status(500).json({
    error: 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { message: err.message })
  });
};

// Middleware de gestion des routes non trouvées
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    method: req.method,
    url: req.url
  });
};

// Middleware de validation des paramètres d'URL
const validateUrlParams = (req, res, next) => {
  // Vérifier les paramètres numériques
  const numericParams = ['id', 'page', 'limit'];
  
  for (const param of numericParams) {
    if (req.params[param] && isNaN(parseInt(req.params[param]))) {
      return res.status(400).json({
        error: `Paramètre ${param} doit être un nombre`
      });
    }
  }

  // Vérifier les paramètres de requête
  if (req.query.page && (isNaN(parseInt(req.query.page)) || parseInt(req.query.page) < 1)) {
    return res.status(400).json({
      error: 'Paramètre page doit être un nombre positif'
    });
  }

  if (req.query.limit && (isNaN(parseInt(req.query.limit)) || parseInt(req.query.limit) < 1 || parseInt(req.query.limit) > 100)) {
    return res.status(400).json({
      error: 'Paramètre limit doit être un nombre entre 1 et 100'
    });
  }

  next();
};

module.exports = {
  generalRateLimit,
  authRateLimit,
  registerRateLimit,
  appointmentRateLimit,
  helmetConfig,
  validateHeaders,
  validateOrigin,
  requestLogger,
  errorHandler,
  notFoundHandler,
  validateUrlParams
};
