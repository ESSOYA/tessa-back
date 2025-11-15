-- -----------------------------------------------------------
-- Recréation complète de la base de données "salon_coiffure"
-- Script MySQL (WAMP) — utf8mb4, InnoDB
-- Corrige la procédure assign_auto_employee et autres points.
-- -----------------------------------------------------------

DROP DATABASE IF EXISTS salon_coiffure;
CREATE DATABASE salon_coiffure CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE salon_coiffure;

SET time_zone = '+00:00';

-- --------------------------
-- TABLES DE RÉFÉRENCE
-- --------------------------
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO roles (name, description) VALUES
('admin','Administrateur du salon'),
('manager','Gestionnaire / Responsable'),
('coiffeur','Coiffeur / Employé'),
('client','Client');

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  phone VARCHAR(30),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  hire_date DATE,
  note TEXT,
  is_available TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- working_hours : jour_semaine 1=Monday .. 7=Sunday
CREATE TABLE working_hours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  jour_semaine TINYINT NOT NULL,  -- 1=Monday .. 7=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT fk_wh_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (jour_semaine BETWEEN 1 AND 7),
  INDEX idx_wh_emp_day (employee_id, jour_semaine)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_user_id INT NOT NULL,
  employee_id INT NULL,
  service_id INT NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  status ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_client FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_appt_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_appt_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_appt_employee (employee_id),
  INDEX idx_appt_client (client_user_id),
  INDEX idx_appt_start (start_datetime),
  INDEX idx_appt_status (status)
) ENGINE=InnoDB;

CREATE TABLE appointment_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ah_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ah_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT,
  user_id INT,
  channel ENUM('email','sms') NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  scheduled_at DATETIME,
  sent_at DATETIME,
  status ENUM('pending','sent','failed') DEFAULT 'pending',
  attempts TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_notif_status (status, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  description TEXT
) ENGINE=InnoDB;

INSERT INTO settings (setting_key, setting_value, description) VALUES
('reminder_before_minutes','1440','Rappel par défaut X minutes avant le RDV (ex: 1440 = 24h)'),
('reminder_second_before_minutes','60','Deuxième rappel 60 min avant'),
('allow_online_booking','1','Autoriser réservation en ligne (1/0)');

-- Index supplémentaire pour performances
ALTER TABLE appointments ADD INDEX idx_appt_range (start_datetime, end_datetime, status);

-- --------------------------
-- PROCÉDURES ET TRIGGERS
-- --------------------------
DELIMITER $$

-- Procédure utilitaire: vérifie si il y a conflit pour un employé donné
CREATE PROCEDURE check_employee_conflict(
  IN p_employee_id INT,
  IN p_start DATETIME,
  IN p_end DATETIME,
  IN p_exclude_appt_id INT
)
BEGIN
  DECLARE cnt INT DEFAULT 0;
  SELECT COUNT(*) INTO cnt
  FROM appointments
  WHERE employee_id = p_employee_id
    AND status IN ('pending','confirmed')
    AND (p_exclude_appt_id IS NULL OR p_exclude_appt_id = 0 OR id <> p_exclude_appt_id)
    AND NOT (end_datetime <= p_start OR start_datetime >= p_end);
  IF cnt > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Conflit: l employe a deja un rendez-vous sur cette plage horaire';
  END IF;
END$$

-- Trigger BEFORE INSERT on appointments : vérifie validité et conflit si employee attribué
CREATE TRIGGER trg_appt_before_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
  IF NEW.start_datetime >= NEW.end_datetime THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Heure de fin doit etre > heure de debut';
  END IF;

  IF NEW.employee_id IS NOT NULL THEN
    CALL check_employee_conflict(NEW.employee_id, NEW.start_datetime, NEW.end_datetime, 0);
  END IF;
END$$

-- Trigger BEFORE UPDATE on appointments : vérification similaire
CREATE TRIGGER trg_appt_before_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
  IF NEW.start_datetime >= NEW.end_datetime THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Heure de fin doit etre > heure de debut';
  END IF;

  IF NEW.employee_id IS NOT NULL THEN
    CALL check_employee_conflict(NEW.employee_id, NEW.start_datetime, NEW.end_datetime, OLD.id);
  END IF;
END$$

-- Procédure: book_appointment (calcul end_datetime depuis durée service)
CREATE PROCEDURE book_appointment(
  IN p_client_user_id INT,
  IN p_service_id INT,
  IN p_start DATETIME,
  IN p_employee_id INT, -- peut etre NULL
  IN p_notes TEXT
)
BEGIN
  DECLARE v_duration INT;
  DECLARE v_end DATETIME;

  SELECT duration_minutes INTO v_duration FROM services WHERE id = p_service_id;
  IF v_duration IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service introuvable';
  END IF;

  SET v_end = DATE_ADD(p_start, INTERVAL v_duration MINUTE);

  INSERT INTO appointments (client_user_id, employee_id, service_id, start_datetime, end_datetime, notes, status)
  VALUES (p_client_user_id, p_employee_id, p_service_id, p_start, v_end, p_notes, IF(p_employee_id IS NULL, 'pending', 'confirmed'));

  INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
  VALUES (LAST_INSERT_ID(), p_client_user_id, 'email', 'Confirmation de rendez-vous', CONCAT('Votre RDV le ', DATE_FORMAT(p_start, '%Y-%m-%d %H:%i')), NOW(), 'pending');
END$$

-- Procédure: cancel_appointment
CREATE PROCEDURE cancel_appointment(
  IN p_appointment_id INT,
  IN p_cancelled_by_user INT,
  IN p_reason TEXT
)
BEGIN
  UPDATE appointments
  SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
  WHERE id = p_appointment_id;

  INSERT INTO appointment_history (appointment_id, action, old_value, new_value, changed_by)
  VALUES (p_appointment_id, 'cancelled', NULL, p_reason, p_cancelled_by_user);

  INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
  SELECT a.id, a.client_user_id, 'email', 'Rendez-vous annulé', CONCAT('Votre rendez-vous du ', DATE_FORMAT(a.start_datetime, '%Y-%m-%d %H:%i'), ' a été annulé. Raison: ', COALESCE(NULLIF(p_reason,''),'Non précisée')), NOW(), 'pending'
  FROM appointments a WHERE a.id = p_appointment_id;
END$$

-- Procédure: assign_auto_employee (corrigée)
-- Affecte automatiquement un employé disponible pour un rendez-vous
CREATE PROCEDURE assign_auto_employee(
  IN p_appointment_id INT
)
BEGIN
  DECLARE v_service_id INT;
  DECLARE v_start DATETIME;
  DECLARE v_end DATETIME;
  DECLARE v_duration INT;
  DECLARE v_day_mysql TINYINT; -- valeur brute DAYOFWEEK (1=Sun..7=Sat)
  DECLARE v_day TINYINT;       -- notre convention 1=Mon..7=Sun
  DECLARE v_time_start TIME;
  DECLARE v_time_end TIME;
  DECLARE chosen_emp INT DEFAULT NULL;

  -- Récupérer le rendez-vous
  SELECT service_id, start_datetime INTO v_service_id, v_start FROM appointments WHERE id = p_appointment_id;
  IF v_service_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rendez-vous introuvable pour assignation';
  END IF;

  -- Récupérer la durée et calculer fin
  SELECT duration_minutes INTO v_duration FROM services WHERE id = v_service_id;
  IF v_duration IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service introuvable pour assignation';
  END IF;

  SET v_end = DATE_ADD(v_start, INTERVAL v_duration MINUTE);

  -- DAYOFWEEK: 1 = Sunday, 2 = Monday, ... 7 = Saturday
  SET v_day_mysql = DAYOFWEEK(v_start);
  -- Convertir vers 1 = Monday ... 7 = Sunday
  SET v_day = CASE
      WHEN v_day_mysql = 1 THEN 7  -- Sunday -> 7
      ELSE v_day_mysql - 1         -- Monday(2)->1, ... Saturday(7)->6
    END;

  SET v_time_start = TIME(v_start);
  SET v_time_end = TIME(v_end);

  -- Chercher un employé disponible tenant compte :
  --  - working_hours pour le jour v_day ;
  --  - travail couvrant la plage (cas simple : working_hours start<=end sur même jour)
  --  - ou working_hours traversant minuit (start_time > end_time) où la plage peut tomber dans la portion du lendemain
  --  - absence de conflit dans appointments
  SELECT e.id INTO chosen_emp
  FROM employees e
  JOIN users u ON u.id = e.user_id
  JOIN working_hours wh ON wh.employee_id = e.id AND wh.jour_semaine = v_day
  WHERE e.is_available = 1
    AND u.is_active = 1
    AND (
      -- Cas 1 : horaire normal sur le même jour (start_time <= end_time)
      (wh.start_time <= wh.end_time AND wh.start_time <= v_time_start AND wh.end_time >= v_time_end)
      OR
      -- Cas 2 : horaire traversant minuit (ex: 22:00 - 04:00)
      (wh.start_time > wh.end_time AND (
         -- la plage demandée commence après start_time (même jour) ou se termine avant end_time (lendemain)
         (v_time_start >= wh.start_time) OR (v_time_end <= wh.end_time)
      ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.employee_id = e.id
        AND a.status IN ('pending','confirmed')
        AND NOT (a.end_datetime <= v_start OR a.start_datetime >= v_end)
    )
  ORDER BY e.id
  LIMIT 1;

  -- Si on a trouvé un employé, on met à jour le RDV et on crée historique + notification
  IF chosen_emp IS NOT NULL THEN
    UPDATE appointments
    SET employee_id = chosen_emp, status = 'confirmed', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_appointment_id;

    INSERT INTO appointment_history (appointment_id, action, old_value, new_value, changed_by)
    VALUES (p_appointment_id, 'auto_assigned', NULL, CONCAT('employee_id=', chosen_emp), NULL);

    INSERT INTO notifications (appointment_id, user_id, channel, subject, body, scheduled_at, status)
    SELECT id, client_user_id, 'email', 'Rendez-vous confirmé', CONCAT('Votre RDV a été confirmé avec le coiffeur #', chosen_emp, ' le ', DATE_FORMAT(start_datetime, '%Y-%m-%d %H:%i')), NOW(), 'pending'
    FROM appointments WHERE id = p_appointment_id;
  END IF;
  -- Si chosen_emp IS NULL : aucune action (le RDV reste en 'pending' pour assignation manuelle ultérieure)
END$$

DELIMITER ;

-- --------------------------
-- VUE pour planning
-- --------------------------
CREATE OR REPLACE VIEW view_daily_schedule AS
SELECT
  a.id AS appointment_id,
  a.start_datetime,
  a.end_datetime,
  a.status,
  s.name AS service_name,
  s.duration_minutes,
  s.price,
  CONCAT(u.first_name,' ',u.last_name) AS client_name,
  emp.user_id AS emp_user_id,
  CONCAT(uemp.first_name,' ',uemp.last_name) AS employee_name
FROM appointments a
LEFT JOIN services s ON s.id = a.service_id
LEFT JOIN users u ON u.id = a.client_user_id
LEFT JOIN employees emp ON emp.id = a.employee_id
LEFT JOIN users uemp ON uemp.id = emp.user_id;

-- --------------------------
-- DONNÉES D'EXEMPLE (seed)
-- --------------------------
INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone) VALUES
((SELECT id FROM roles WHERE name='admin'), 'admin@salon.test', 'hash_admin', 'Admin', 'Salon', '000000000'),
((SELECT id FROM roles WHERE name='coiffeur'), 'john@salon.test', 'hash_john', 'John', 'Doe', '0612345678'),
((SELECT id FROM roles WHERE name='coiffeur'), 'marie@salon.test', 'hash_marie', 'Marie', 'Claire', '0698765432'),
((SELECT id FROM roles WHERE name='client'), 'client1@ex.com', 'hash_client1', 'Paul', 'Martin', '0666000000'),
((SELECT id FROM roles WHERE name='client'), 'client2@ex.com', 'hash_client2', 'Sophie', 'Durand', '0666111111');

INSERT INTO employees (user_id, hire_date, note) VALUES
((SELECT id FROM users WHERE email='john@salon.test'), '2022-01-01', 'Spécialiste coupe homme'),
((SELECT id FROM users WHERE email='marie@salon.test'), '2023-03-15', 'Coloration experte');

INSERT INTO services (name, description, duration_minutes, price) VALUES
('Coupe homme','Coupe classique homme',30,20.00),
('Coupe femme','Coupe avec brushing',45,35.00),
('Brushing','Brushing simple',30,25.00),
('Coloration','Coloration complète',90,70.00),
('Tresses','Tresses traditionnel',120,100.00);

-- working_hours pour John (Lundi-Vendredi 09:00-17:00)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time)
SELECT emp.id, d.day, '09:00','17:00'
FROM employees emp
JOIN users u ON u.id = emp.user_id
CROSS JOIN (SELECT 1 AS day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
WHERE u.email = 'john@salon.test';

-- working_hours pour Marie (Mardi-Samedi 10:00-18:00)
INSERT INTO working_hours (employee_id, jour_semaine, start_time, end_time)
SELECT emp.id, d.day, '10:00','18:00'
FROM employees emp
JOIN users u ON u.id = emp.user_id
CROSS JOIN (SELECT 2 AS day UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) d
WHERE u.email = 'marie@salon.test';

-- Exemple RDV confirmé
INSERT INTO appointments (client_user_id, employee_id, service_id, start_datetime, end_datetime, status, notes)
VALUES (
  (SELECT u.id FROM users u WHERE u.email='client1@ex.com'),
  (SELECT e.id FROM employees e JOIN users u ON u.id = e.user_id WHERE u.email='john@salon.test'),
  (SELECT s.id FROM services s WHERE s.name='Coupe homme'),
  '2025-10-23 10:00:00',
  '2025-10-23 10:30:00',
  'confirmed',
  'Premiere visite'
);

-- --------------------------
-- NOTES / BONNES PRATIQUES
-- --------------------------
-- 1) Les envois d'email/SMS doivent être effectué côté application (worker/cron) qui lit la table `notifications`.
-- 2) Hachage mot de passe : bcrypt/argon2 côté application. La colonne stocke le hash.
-- 3) Si la logique d'horaires est plus complexe (plages répétitives irrégulières, pause, congés), ajouter tables de exceptions (vacations, leaves, day_offs).
-- 4) Sauvegardes régulières et TLS sur serveur de production.

-- Fin du script
