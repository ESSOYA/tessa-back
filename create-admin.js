const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAdminUser() {
    console.log('=== CRÉATION DE L\'UTILISATEUR ADMIN TESSA COIFFURE ===');
    
    let connection;
    
    try {
        // Configuration de la base de données
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'salon_coiffure'
        };
        
        console.log('Configuration de la base de données:');
        console.log(`  Host: ${dbConfig.host}`);
        console.log(`  User: ${dbConfig.user}`);
        console.log(`  Database: ${dbConfig.database}`);
        
        // Connexion à la base de données
        connection = await mysql.createConnection(dbConfig);
        console.log('\n✅ Connexion à la base de données réussie');
        
        // 1. Insérer le rôle admin s'il n'existe pas
        console.log('\n📝 Création du rôle admin...');
        await connection.execute(`
            INSERT IGNORE INTO roles (name, description) 
            VALUES ('admin', 'Administrateur du salon')
        `);
        
        // 2. Vérifier si l'utilisateur admin existe déjà
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            ['admin@tessa-coiffure.com']
        );
        
        if (existingUsers.length > 0) {
            console.log('⚠️  L\'utilisateur admin existe déjà');
            console.log('\n=== IDENTIFIANTS DE CONNEXION ADMIN ===');
            console.log('📧 Email: admin@tessa-coiffure.com');
            console.log('🔑 Mot de passe: password');
            console.log('👤 Nom: Admin TESSA COIFFURE');
            console.log('🔐 Rôle: Administrateur');
            console.log('\n🌐 URL de connexion admin: http://localhost:8080/admin/login');
            return;
        }
        
        // 3. Insérer l'utilisateur admin
        console.log('📝 Création de l\'utilisateur admin...');
        const hashedPassword = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // password
        
        const [userResult] = await connection.execute(`
            INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, (SELECT id FROM roles WHERE name = 'admin'), 1, NOW(), NOW())
        `, [
            'admin@tessa-coiffure.com',
            hashedPassword,
            'Admin',
            'TESSA COIFFURE',
            '01 23 45 67 89'
        ]);
        
        const userId = userResult.insertId;
        console.log(`✅ Utilisateur admin créé avec l'ID: ${userId}`);
        
        // 4. Insérer l'employé admin
        console.log('📝 Création de l\'employé admin...');
        await connection.execute(`
            INSERT INTO employees (user_id, hire_date, note, is_available)
            VALUES (?, CURDATE(), ?, 1)
        `, [
            userId,
            'Administrateur principal de TESSA COIFFURE'
        ]);
        
        console.log('✅ Employé admin créé');
        
        // 5. Afficher les identifiants
        console.log('\n✅ Utilisateur admin créé avec succès !');
        console.log('\n=== IDENTIFIANTS DE CONNEXION ADMIN ===');
        console.log('📧 Email: admin@tessa-coiffure.com');
        console.log('🔑 Mot de passe: password');
        console.log('👤 Nom: Admin TESSA COIFFURE');
        console.log('🔐 Rôle: Administrateur');
        console.log('\n🌐 URL de connexion admin: http://localhost:8080/admin/login');
        
    } catch (error) {
        console.error('❌ Erreur lors de la création de l\'utilisateur admin:', error.message);
        console.error('Détails:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Connexion fermée');
        }
    }
}

// Exécuter le script
createAdminUser().then(() => {
    console.log('\n=== INSTRUCTIONS ===');
    console.log('1. Démarrez le backend: cd backend && node src/server.js');
    console.log('2. Démarrez le frontend: npm run dev');
    console.log('3. Allez sur: http://localhost:8080/admin/login');
    console.log('4. Connectez-vous avec les identifiants ci-dessus');
    process.exit(0);
}).catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
});
