const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import des middlewares
const {
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
} = require('./middleware/security');

// Import des routes
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const appointmentRoutes = require('./routes/appointments');
const employeeRoutes = require('./routes/employees');
const statsRoutes = require('./routes/stats');
const clientsRoutes = require('./routes/clients');
const serviceImagesRoutes = require('./routes/serviceImages');
const siteSettingsRoutes = require('./routes/siteSettings');
const imagesRoutes = require('./routes/images');
const reportsRoutes = require('./routes/reports');

// Import des services
const { testConnection } = require('./config/database');
const notificationCron = require('./cron/notificationCron');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration CORS
const corsOptions = {
  origin: function (origin, callback) {
    // En développement, autoriser toutes les origines localhost
    if (process.env.NODE_ENV === 'development') {
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://tessa-front.vercel.app',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:8081'
    ].filter(Boolean);

    // Autoriser les requêtes sans origine (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Servir les fichiers statiques EN PREMIER, avant tous les autres middlewares
// Cela évite que Helmet ou d'autres middlewares interfèrent
app.use('/public', (req, res, next) => {
  // Ajouter les headers CORS pour les fichiers statiques
  const origin = req.headers.origin;
  
  // Toujours autoriser les requêtes pour les fichiers statiques
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // Supprimer tous les headers de sécurité qui pourraient bloquer
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    // Définir le type MIME correct pour les images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    // Headers CORS pour les fichiers statiques
    const origin = res.req?.headers?.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  }
}));

// Middlewares globaux (après les fichiers statiques)
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Appliquer Helmet après les fichiers statiques pour éviter les conflits
// Mais exclure les fichiers statiques de la CSP
app.use((req, res, next) => {
  if (req.path.startsWith('/public/')) {
    // Pour les fichiers statiques, ne pas appliquer Helmet du tout
    return next();
  }
  helmetConfig(req, res, next);
});

app.use(requestLogger);
app.use(validateHeaders);
app.use(validateOrigin);
app.use(validateUrlParams);

// Rate limiting global (exclure les fichiers statiques)
app.use((req, res, next) => {
  if (req.path.startsWith('/public/')) {
    return next();
  }
  generalRateLimit(req, res, next);
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'TESSA COIFFURE API',
    version: '1.0.0',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      docs: '/api/docs'
    }
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route d'information API
app.get('/api', (req, res) => {
  res.json({
    name: 'TESSA COIFFURE API',
    version: '1.0.0',
    description: 'API REST pour la gestion d\'un salon de coiffure',
    endpoints: {
      auth: '/api/auth',
      services: '/api/services',
      appointments: '/api/appointments',
      employees: '/api/employees'
    },
    documentation: '/api/docs'
  });
});

// Routes avec rate limiting spécifique
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', registerRateLimit);
app.use('/api/appointments', appointmentRateLimit);

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/service-images', serviceImagesRoutes);
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/reports', reportsRoutes);

// Route de documentation (simple)
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Documentation API TESSA COIFFURE',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      authentication: {
        'POST /auth/login': 'Connexion utilisateur',
        'POST /auth/register': 'Inscription client',
        'GET /auth/me': 'Profil utilisateur',
        'PUT /auth/profile': 'Mise à jour profil',
        'POST /auth/logout': 'Déconnexion',
        'POST /auth/change-password': 'Changer mot de passe'
      },
      services: {
        'GET /services': 'Liste des services',
        'GET /services/:id': 'Détail service',
        'POST /services': 'Créer service (Admin)',
        'PUT /services/:id': 'Modifier service (Admin)',
        'DELETE /services/:id': 'Supprimer service (Admin)',
        'GET /services/public/active': 'Services actifs (public)'
      },
      appointments: {
        'GET /appointments': 'Liste rendez-vous',
        'GET /appointments/:id': 'Détail rendez-vous',
        'POST /appointments': 'Créer rendez-vous',
        'PATCH /appointments/:id/status': 'Changer statut',
        'POST /appointments/:id/assign': 'Assigner employé',
        'DELETE /appointments/:id': 'Annuler rendez-vous',
        'GET /appointments/availability/:service_id': 'Créneaux disponibles',
        'GET /appointments/my/appointments': 'Mes rendez-vous'
      },
      employees: {
        'GET /employees': 'Liste employés',
        'GET /employees/:id': 'Détail employé',
        'POST /employees': 'Créer employé (Admin)',
        'PUT /employees/:id': 'Modifier employé (Admin)',
        'DELETE /employees/:id': 'Supprimer employé (Admin)',
        'GET /employees/available': 'Employés disponibles'
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>'
    }
  });
});

// Gestion des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

// Démarrage du serveur
const startServer = async () => {
  try {
    // Tester la connexion à la base de données
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Impossible de se connecter à la base de données');
      process.exit(1);
    }

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📚 Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🏥 Santé: http://localhost:${PORT}/health`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    });

    // Démarrer les cron jobs
    notificationCron.start();

    // Gestion propre de l'arrêt
    process.on('SIGTERM', () => {
      console.log('🛑 Signal SIGTERM reçu, arrêt du serveur...');
      notificationCron.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('🛑 Signal SIGINT reçu, arrêt du serveur...');
      notificationCron.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  process.exit(1);
});

// Démarrer le serveur
startServer();

module.exports = app;
