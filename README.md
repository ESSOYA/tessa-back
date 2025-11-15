# Salon Coiffure Backend API

API REST complète pour la gestion d'un salon de coiffure avec système de rendez-vous, gestion des employés et notifications automatiques.

## 🚀 Fonctionnalités

- **Authentification JWT** avec rôles (admin, manager, coiffeur, client)
- **Gestion des services** (création, modification, suppression)
- **Système de rendez-vous** avec attribution automatique d'employés
- **Gestion des employés** et horaires de travail
- **Notifications automatiques** (email de confirmation, rappels)
- **Sécurité avancée** (rate limiting, validation, CORS)
- **Base de données MySQL** avec procédures stockées

## 📋 Prérequis

- Node.js 16+ 
- MySQL 8.0+
- npm ou yarn
- Compte SendGrid (optionnel, pour les emails)

## 🛠️ Installation

1. **Cloner et installer les dépendances**
```bash
cd backend
npm install
```

2. **Configuration de l'environnement**
```bash
cp env.example .env
```

Éditer le fichier `.env` avec vos paramètres :
```env
# Base de données
DB_HOST=localhost
DB_PORT=3306
DB_NAME=salon_coiffure
DB_USER=root
DB_PASSWORD=votre_mot_de_passe

# JWT
JWT_SECRET=votre-secret-jwt-super-securise
JWT_EXPIRES_IN=24h

# Email (optionnel)
SENDGRID_API_KEY=votre-cle-sendgrid
EMAIL_FROM=noreply@salon-coiffure.com

# Serveur
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

3. **Configuration de la base de données**
```bash
# Créer la base de données
mysql -u root -p < database/schema.sql

# Ou exécuter le script SQL fourni dans le fichier
```

4. **Démarrer le serveur**
```bash
# Développement
npm run dev

# Production
npm start
```

## 📚 Documentation API

### Base URL
```
http://localhost:3000/api
```

### Authentification

#### Connexion
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@salon.test",
  "password": "password123"
}
```

#### Inscription client
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "password123",
  "first_name": "Jean",
  "last_name": "Dupont",
  "phone": "0612345678"
}
```

### Services

#### Lister les services
```http
GET /api/services
```

#### Créer un service (Admin)
```http
POST /api/services
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Coupe Femme",
  "description": "Coupe personnalisée avec conseil styling",
  "duration_minutes": 45,
  "price": 35.00
}
```

### Rendez-vous

#### Créer un rendez-vous
```http
POST /api/appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_user_id": 1,
  "service_id": 1,
  "start_datetime": "2025-01-25 14:00:00",
  "employee_id": null,
  "notes": "Première visite"
}
```

#### Vérifier les disponibilités
```http
GET /api/appointments/availability/1?date=2025-01-25&time=14:00
```

#### Changer le statut
```http
PATCH /api/appointments/1/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "confirmed",
  "reason": "Client confirmé par téléphone"
}
```

### Employés

#### Lister les employés
```http
GET /api/employees
Authorization: Bearer <token>
```

#### Créer un employé (Admin)
```http
POST /api/employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": 2,
  "hire_date": "2025-01-01",
  "note": "Spécialiste coupe homme"
}
```

## 🔐 Rôles et Permissions

| Rôle | Permissions |
|------|-------------|
| **Admin** | Toutes les permissions |
| **Manager** | Gestion des rendez-vous et employés |
| **Coiffeur** | Voir ses propres rendez-vous |
| **Client** | Créer et gérer ses rendez-vous |

## 📧 Système de Notifications

Le système envoie automatiquement :

- **Email de confirmation** lors de la création d'un rendez-vous
- **Rappel automatique** 24h avant le rendez-vous
- **Email d'annulation** en cas d'annulation

### Configuration Email

1. **SendGrid** (recommandé)
```env
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@salon-coiffure.com
```

2. **Mode développement** (Ethereal Email)
Les emails sont générés mais pas envoyés réellement.

## 🛡️ Sécurité

- **Rate Limiting** : Protection contre les attaques par déni de service
- **Validation** : Validation stricte de toutes les entrées
- **CORS** : Configuration sécurisée des origines autorisées
- **Helmet** : Headers de sécurité HTTP
- **JWT** : Authentification par tokens

## 📊 Base de Données

### Tables Principales

- `users` - Utilisateurs (clients, employés, admins)
- `roles` - Rôles système
- `services` - Services proposés
- `employees` - Employés du salon
- `appointments` - Rendez-vous
- `working_hours` - Horaires de travail
- `notifications` - Notifications à envoyer

### Procédures Stockées

- `book_appointment()` - Créer un rendez-vous
- `assign_auto_employee()` - Attribution automatique
- `cancel_appointment()` - Annuler un rendez-vous

## 🚀 Déploiement

### Variables d'environnement de production

```env
NODE_ENV=production
DB_HOST=your-db-host
DB_PASSWORD=secure-password
JWT_SECRET=very-secure-secret
SENDGRID_API_KEY=your-sendgrid-key
```

### Plateformes recommandées

- **Heroku** : Déploiement simple
- **Railway** : Moderne et efficace
- **DigitalOcean** : Contrôle total
- **AWS** : Scalabilité avancée

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:coverage
```

## 📝 Logs

Les logs incluent :
- Requêtes HTTP avec durée
- Erreurs de base de données
- Envois d'emails
- Activité des cron jobs

## 🔧 Maintenance

### Nettoyage automatique
- Suppression des anciennes notifications (30 jours)
- Nettoyage des notifications échouées (7 jours)

### Monitoring
```http
GET /health
```

## 📞 Support

Pour toute question :
- Consulter la documentation API : `/api/docs`
- Vérifier les logs du serveur
- Tester la connexion : `/health`

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2025

