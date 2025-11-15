-- Script pour insérer 10 employés avec leurs spécialités
-- Note: Ce script crée d'abord un rôle "employee" si nécessaire, puis les utilisateurs et employés

-- 1. Créer le rôle "employee" s'il n'existe pas
INSERT IGNORE INTO roles (id, name, description) 
VALUES (3, 'employee', 'Employé du salon');

-- 2. Insérer 10 utilisateurs (employés)
-- Le mot de passe par défaut est "password123" (hash bcrypt)
-- Vous devrez changer ces mots de passe après la première connexion
-- Note: Les IDs seront auto-générés, on récupère les IDs après insertion

SET @user_id_1 = NULL;
SET @user_id_2 = NULL;
SET @user_id_3 = NULL;
SET @user_id_4 = NULL;
SET @user_id_5 = NULL;
SET @user_id_6 = NULL;
SET @user_id_7 = NULL;
SET @user_id_8 = NULL;
SET @user_id_9 = NULL;
SET @user_id_10 = NULL;

-- Insérer les utilisateurs et récupérer leurs IDs
INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, is_active) VALUES
(3, 'marie.dubois@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Marie', 'Dubois', '0612345678', 1),
(3, 'sophie.martin@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Sophie', 'Martin', '0612345679', 1),
(3, 'julie.bernard@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Julie', 'Bernard', '0612345680', 1),
(3, 'lucie.thomas@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Lucie', 'Thomas', '0612345681', 1),
(3, 'emilie.petit@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Emilie', 'Petit', '0612345682', 1),
(3, 'camille.robert@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Camille', 'Robert', '0612345683', 1),
(3, 'lea.richard@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Léa', 'Richard', '0612345684', 1),
(3, 'chloe.durand@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Chloé', 'Durand', '0612345685', 1),
(3, 'laura.moreau@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Laura', 'Moreau', '0612345686', 1),
(3, 'sarah.laurent@tessa-coiffure.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5q', 'Sarah', 'Laurent', '0612345687', 1)
ON DUPLICATE KEY UPDATE email = email;

-- Récupérer les IDs des utilisateurs créés
SELECT @user_id_1 := id FROM users WHERE email = 'marie.dubois@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_2 := id FROM users WHERE email = 'sophie.martin@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_3 := id FROM users WHERE email = 'julie.bernard@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_4 := id FROM users WHERE email = 'lucie.thomas@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_5 := id FROM users WHERE email = 'emilie.petit@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_6 := id FROM users WHERE email = 'camille.robert@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_7 := id FROM users WHERE email = 'lea.richard@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_8 := id FROM users WHERE email = 'chloe.durand@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_9 := id FROM users WHERE email = 'laura.moreau@tessa-coiffure.com' LIMIT 1;
SELECT @user_id_10 := id FROM users WHERE email = 'sarah.laurent@tessa-coiffure.com' LIMIT 1;

-- 3. Insérer les employés avec leurs spécialités
-- Spécialités: Coupe Femme, Coupe Homme, Coloration, Brushing, Tresses, Soin Capillaire
INSERT INTO employees (user_id, hire_date, note, is_available) VALUES
(@user_id_1, '2024-01-15', 'Spécialité: Coupe Femme, Coloration', 1),
(@user_id_2, '2024-02-01', 'Spécialité: Coupe Homme, Brushing', 1),
(@user_id_3, '2024-02-15', 'Spécialité: Coupe Femme, Tresses', 1),
(@user_id_4, '2024-03-01', 'Spécialité: Coloration, Soin Capillaire', 1),
(@user_id_5, '2024-03-15', 'Spécialité: Coupe Femme, Brushing', 1),
(@user_id_6, '2024-04-01', 'Spécialité: Coupe Homme, Soin Capillaire', 1),
(@user_id_7, '2024-04-15', 'Spécialité: Tresses, Coloration', 1),
(@user_id_8, '2024-05-01', 'Spécialité: Coupe Femme, Soin Capillaire', 1),
(@user_id_9, '2024-05-15', 'Spécialité: Brushing, Tresses', 1),
(@user_id_10, '2024-06-01', 'Spécialité: Coupe Homme, Brushing', 1)
ON DUPLICATE KEY UPDATE note = VALUES(note);

-- 4. Récupérer les IDs des employés créés
SET @emp_id_1 = NULL;
SET @emp_id_2 = NULL;
SET @emp_id_3 = NULL;
SET @emp_id_4 = NULL;
SET @emp_id_5 = NULL;
SET @emp_id_6 = NULL;
SET @emp_id_7 = NULL;
SET @emp_id_8 = NULL;
SET @emp_id_9 = NULL;
SET @emp_id_10 = NULL;

SELECT @emp_id_1 := id FROM employees WHERE user_id = @user_id_1 LIMIT 1;
SELECT @emp_id_2 := id FROM employees WHERE user_id = @user_id_2 LIMIT 1;
SELECT @emp_id_3 := id FROM employees WHERE user_id = @user_id_3 LIMIT 1;
SELECT @emp_id_4 := id FROM employees WHERE user_id = @user_id_4 LIMIT 1;
SELECT @emp_id_5 := id FROM employees WHERE user_id = @user_id_5 LIMIT 1;
SELECT @emp_id_6 := id FROM employees WHERE user_id = @user_id_6 LIMIT 1;
SELECT @emp_id_7 := id FROM employees WHERE user_id = @user_id_7 LIMIT 1;
SELECT @emp_id_8 := id FROM employees WHERE user_id = @user_id_8 LIMIT 1;
SELECT @emp_id_9 := id FROM employees WHERE user_id = @user_id_9 LIMIT 1;
SELECT @emp_id_10 := id FROM employees WHERE user_id = @user_id_10 LIMIT 1;

-- 5. Insérer les horaires de travail pour chaque employé
-- Horaires: Lundi-Vendredi 9h-18h, Samedi 9h-17h, Dimanche fermé
-- jour_semaine: 1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi, 6=Samedi, 7=Dimanche

-- Employé 1 (Marie Dubois)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_1, 1, '09:00:00', '18:00:00'),
(@emp_id_1, 2, '09:00:00', '18:00:00'),
(@emp_id_1, 3, '09:00:00', '18:00:00'),
(@emp_id_1, 4, '09:00:00', '18:00:00'),
(@emp_id_1, 5, '09:00:00', '18:00:00'),
(@emp_id_1, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 2 (Sophie Martin)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_2, 1, '09:00:00', '18:00:00'),
(@emp_id_2, 2, '09:00:00', '18:00:00'),
(@emp_id_2, 3, '09:00:00', '18:00:00'),
(@emp_id_2, 4, '09:00:00', '18:00:00'),
(@emp_id_2, 5, '09:00:00', '18:00:00'),
(@emp_id_2, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 3 (Julie Bernard)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_3, 1, '09:00:00', '18:00:00'),
(@emp_id_3, 2, '09:00:00', '18:00:00'),
(@emp_id_3, 3, '09:00:00', '18:00:00'),
(@emp_id_3, 4, '09:00:00', '18:00:00'),
(@emp_id_3, 5, '09:00:00', '18:00:00'),
(@emp_id_3, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 4 (Lucie Thomas)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_4, 1, '09:00:00', '18:00:00'),
(@emp_id_4, 2, '09:00:00', '18:00:00'),
(@emp_id_4, 3, '09:00:00', '18:00:00'),
(@emp_id_4, 4, '09:00:00', '18:00:00'),
(@emp_id_4, 5, '09:00:00', '18:00:00'),
(@emp_id_4, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 5 (Emilie Petit)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_5, 1, '09:00:00', '18:00:00'),
(@emp_id_5, 2, '09:00:00', '18:00:00'),
(@emp_id_5, 3, '09:00:00', '18:00:00'),
(@emp_id_5, 4, '09:00:00', '18:00:00'),
(@emp_id_5, 5, '09:00:00', '18:00:00'),
(@emp_id_5, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 6 (Camille Robert)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_6, 1, '09:00:00', '18:00:00'),
(@emp_id_6, 2, '09:00:00', '18:00:00'),
(@emp_id_6, 3, '09:00:00', '18:00:00'),
(@emp_id_6, 4, '09:00:00', '18:00:00'),
(@emp_id_6, 5, '09:00:00', '18:00:00'),
(@emp_id_6, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 7 (Léa Richard)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_7, 1, '09:00:00', '18:00:00'),
(@emp_id_7, 2, '09:00:00', '18:00:00'),
(@emp_id_7, 3, '09:00:00', '18:00:00'),
(@emp_id_7, 4, '09:00:00', '18:00:00'),
(@emp_id_7, 5, '09:00:00', '18:00:00'),
(@emp_id_7, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 8 (Chloé Durand)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_8, 1, '09:00:00', '18:00:00'),
(@emp_id_8, 2, '09:00:00', '18:00:00'),
(@emp_id_8, 3, '09:00:00', '18:00:00'),
(@emp_id_8, 4, '09:00:00', '18:00:00'),
(@emp_id_8, 5, '09:00:00', '18:00:00'),
(@emp_id_8, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 9 (Laura Moreau)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_9, 1, '09:00:00', '18:00:00'),
(@emp_id_9, 2, '09:00:00', '18:00:00'),
(@emp_id_9, 3, '09:00:00', '18:00:00'),
(@emp_id_9, 4, '09:00:00', '18:00:00'),
(@emp_id_9, 5, '09:00:00', '18:00:00'),
(@emp_id_9, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- Employé 10 (Sarah Laurent)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time) VALUES
(@emp_id_10, 1, '09:00:00', '18:00:00'),
(@emp_id_10, 2, '09:00:00', '18:00:00'),
(@emp_id_10, 3, '09:00:00', '18:00:00'),
(@emp_id_10, 4, '09:00:00', '18:00:00'),
(@emp_id_10, 5, '09:00:00', '18:00:00'),
(@emp_id_10, 6, '09:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);
