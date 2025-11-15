-- Script pour créer un utilisateur admin TESSA COIFFURE
-- Ce script insère un utilisateur admin dans la base de données

-- 1. Insérer le rôle admin s'il n'existe pas
INSERT IGNORE INTO roles (name, description) VALUES 
('admin', 'Administrateur du salon');

-- 2. Insérer l'utilisateur admin
INSERT INTO users (
    email, 
    password, 
    first_name, 
    last_name, 
    phone, 
    role_id, 
    is_active, 
    created_at, 
    updated_at
) VALUES (
    'admin@tessa-coiffure.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- mot de passe: password
    'Admin',
    'TESSA COIFFURE',
    '01 23 45 67 89',
    (SELECT id FROM roles WHERE name = 'admin'),
    1,
    NOW(),
    NOW()
);

-- 3. Insérer l'employé admin
INSERT INTO employees (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    specializations,
    is_active,
    created_at,
    updated_at
) VALUES (
    (SELECT id FROM users WHERE email = 'admin@tessa-coiffure.com'),
    'Admin',
    'TESSA COIFFURE',
    'admin@tessa-coiffure.com',
    '01 23 45 67 89',
    '["Administration", "Gestion"]',
    1,
    NOW(),
    NOW()
);

-- 4. Afficher les informations de connexion
SELECT 
    '=== IDENTIFIANTS ADMIN TESSA COIFFURE ===' as info,
    u.email as email,
    'password' as mot_de_passe,
    CONCAT(u.first_name, ' ', u.last_name) as nom_complet,
    r.name as role,
    u.is_active as actif
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.email = 'admin@tessa-coiffure.com';


