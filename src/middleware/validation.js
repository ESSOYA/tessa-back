const Joi = require('joi');

// Middleware de validation générique
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Données invalides',
        details: errors
      });
    }

    // Remplacer les données validées
    req[property] = value;
    next();
  };
};

// Schémas de validation pour l'authentification
const authSchemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().min(2).max(100).required(),
    last_name: Joi.string().min(2).max(100).allow(''),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow(''),
    role_id: Joi.number().integer().positive().optional()
  })
};

// Schémas de validation pour les services
const serviceSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    description: Joi.string().max(1000).allow(''),
    duration_minutes: Joi.number().integer().min(15).max(480).required(),
    price: Joi.number().precision(2).min(0).required()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(150),
    description: Joi.string().max(1000).allow(''),
    duration_minutes: Joi.number().integer().min(15).max(480),
    price: Joi.number().precision(2).min(0),
    is_active: Joi.boolean()
  })
};

// Schémas de validation pour les rendez-vous
const appointmentSchemas = {
  create: Joi.object({
    client_user_id: Joi.number().integer().positive().required(),
    service_id: Joi.number().integer().positive().required(),
    start_datetime: Joi.date().iso().greater('now').required(),
    employee_id: Joi.number().integer().positive().allow(null),
    notes: Joi.string().max(500).allow('')
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled', 'no_show').required(),
    reason: Joi.string().max(200).allow('')
  }),

  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
    employee_id: Joi.number().integer().positive(),
    client_id: Joi.number().integer().positive(),
    date_from: Joi.date().iso(),
    date_to: Joi.date().iso()
  })
};

// Schémas de validation pour les employés
const employeeSchemas = {
  create: Joi.object({
    user_id: Joi.number().integer().positive().required(),
    hire_date: Joi.date().iso().max('now'),
    note: Joi.string().max(500).allow('')
  }),

  workingHours: Joi.object({
    jour_semaine: Joi.number().integer().min(1).max(7).required(),
    start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
  })
};

// Schémas de validation pour les utilisateurs
const userSchemas = {
  update: Joi.object({
    first_name: Joi.string().min(2).max(100),
    last_name: Joi.string().min(2).max(100).allow(''),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow('')
  }),

  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('admin', 'manager', 'coiffeur', 'client'),
    search: Joi.string().max(100).allow('')
  })
};

// Middleware de validation des paramètres d'URL
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params);

    if (error) {
      return res.status(400).json({
        error: 'Paramètres invalides',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.params = value;
    next();
  };
};

// Validation des paramètres d'ID
const validateId = validateParams(Joi.object({
  id: Joi.number().integer().positive().required()
}));

module.exports = {
  validate,
  validateParams,
  validateId,
  authSchemas,
  serviceSchemas,
  appointmentSchemas,
  employeeSchemas,
  userSchemas
};
