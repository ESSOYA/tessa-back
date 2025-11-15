const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données
const dbConfig = {
  host: 'mysql-zigh-portfolio.alwaysdata.net',
  port:  3306,
  user:  '404304',
  password:  'Campement@2024',
  database:  'zigh-portfolio_salon_coiffure',
  charset: 'utf8mb4',
  timezone: '+00:00'
};

// Pool de connexions pour de meilleures performances
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test de connexion
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données MySQL réussie');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    return false;
  }
};

// Fonction utilitaire pour exécuter des requêtes
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Erreur SQL:', error.message);
    throw error;
  }
};

// Fonction pour les transactions
const executeTransaction = async (queries) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  executeQuery,
  executeTransaction,
  testConnection
};





// const mysql = require('mysql2/promise');
// require('dotenv').config();

// // Configuration de la base de données
// const dbConfig = {
//   host: process.env.DB_HOST || 'localhost',
//   port: process.env.DB_PORT || 3306,
//   user: process.env.DB_USER || 'root',
//   password: process.env.DB_PASSWORD || '',
//   database: process.env.DB_NAME || 'salon_coiffure',
//   charset: 'utf8mb4',
//   timezone: '+00:00'
// };

// // Pool de connexions pour de meilleures performances
// const pool = mysql.createPool({
//   ...dbConfig,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// // Test de connexion
// const testConnection = async () => {
//   try {
//     const connection = await pool.getConnection();
//     console.log('✅ Connexion à la base de données MySQL réussie');
//     connection.release();
//     return true;
//   } catch (error) {
//     console.error('❌ Erreur de connexion à la base de données:', error.message);
//     return false;
//   }
// };

// // Fonction utilitaire pour exécuter des requêtes
// const executeQuery = async (query, params = []) => {
//   try {
//     const [results] = await pool.execute(query, params);
//     return results;
//   } catch (error) {
//     console.error('Erreur SQL:', error.message);
//     throw error;
//   }
// };

// // Fonction pour les transactions
// const executeTransaction = async (queries) => {
//   const connection = await pool.getConnection();
//   try {
//     await connection.beginTransaction();
    
//     const results = [];
//     for (const { query, params } of queries) {
//       const [result] = await connection.execute(query, params);
//       results.push(result);
//     }
    
//     await connection.commit();
//     return results;
//   } catch (error) {
//     await connection.rollback();
//     throw error;
//   } finally {
//     connection.release();
//   }
// };

// module.exports = {
//   pool,
//   executeQuery,
//   executeTransaction,
//   testConnection
// };
