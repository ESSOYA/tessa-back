-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: mysql-zigh-portfolio.alwaysdata.net
-- Generation Time: Nov 14, 2025 at 09:39 PM
-- Server version: 10.11.14-MariaDB
-- PHP Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `zigh-portfolio_salon_coiffure`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`404304`@`%` PROCEDURE `assign_auto_employee` (IN `p_appointment_id` INT)   BEGIN
  DECLARE v_service_id INT;
  DECLARE v_start DATETIME;
  DECLARE v_end DATETIME;
  DECLARE v_duration INT;
  DECLARE v_day_mysql TINYINT;
  DECLARE v_day TINYINT;
  DECLARE v_time_start TIME;
  DECLARE v_time_end TIME;
  DECLARE chosen_emp INT DEFAULT NULL;

  SELECT service_id, start_datetime INTO v_service_id, v_start
  FROM appointments WHERE id = p_appointment_id;

  IF v_service_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rendez-vous introuvable pour assignation';
  END IF;

  SELECT duration_minutes INTO v_duration FROM services WHERE id = v_service_id;

  SET v_end = DATE_ADD(v_start, INTERVAL v_duration MINUTE);
  SET v_day_mysql = DAYOFWEEK(v_start);
  SET v_day = CASE WHEN v_day_mysql = 1 THEN 7 ELSE v_day_mysql - 1 END;
  SET v_time_start = TIME(v_start);
  SET v_time_end = TIME(v_end);

  SELECT e.id INTO chosen_emp
  FROM employees e
  JOIN users u ON u.id = e.user_id
  JOIN working_hours wh ON wh.employee_id = e.id AND wh.jour_semaine = v_day
  WHERE e.is_available = 1
    AND u.is_active = 1
    AND ((wh.start_time <= wh.end_time AND wh.start_time <= v_time_start AND wh.end_time >= v_time_end)
         OR (wh.start_time > wh.end_time AND ((v_time_start >= wh.start_time) OR (v_time_end <= wh.end_time))))
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.employee_id = e.id
        AND a.status IN ('pending','confirmed')
        AND NOT (a.end_datetime <= v_start OR a.start_datetime >= v_end)
    )
  ORDER BY e.id
  LIMIT 1;

  IF chosen_emp IS NOT NULL THEN
    UPDATE appointments
    SET employee_id = chosen_emp, status = 'confirmed', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_appointment_id;

    INSERT INTO appointment_history (appointment_id, action, old_value, new_value, changed_by)
    VALUES (p_appointment_id, 'auto_assigned', NULL, CONCAT('employee_id=', chosen_emp), NULL);
  END IF;
END$$

CREATE DEFINER=`404304`@`%` PROCEDURE `book_appointment` (IN `p_client_user_id` INT, IN `p_service_id` INT, IN `p_start` DATETIME, IN `p_employee_id` INT, IN `p_notes` TEXT)   BEGIN
  DECLARE v_duration INT;
  DECLARE v_end DATETIME;

  SELECT duration_minutes INTO v_duration FROM services WHERE id = p_service_id;
  SET v_end = DATE_ADD(p_start, INTERVAL v_duration MINUTE);

  INSERT INTO appointments (client_user_id, employee_id, service_id, start_datetime, end_datetime, notes, status)
  VALUES (p_client_user_id, p_employee_id, p_service_id, p_start, v_end, p_notes, IF(p_employee_id IS NULL, 'pending', 'confirmed'));
END$$

CREATE DEFINER=`404304`@`%` PROCEDURE `cancel_appointment` (IN `p_appointment_id` INT, IN `p_cancelled_by_user` INT, IN `p_reason` TEXT)   BEGIN
  UPDATE appointments
  SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
  WHERE id = p_appointment_id;

  INSERT INTO appointment_history (appointment_id, action, old_value, new_value, changed_by)
  VALUES (p_appointment_id, 'cancelled', NULL, p_reason, p_cancelled_by_user);
END$$

CREATE DEFINER=`404304`@`%` PROCEDURE `check_employee_conflict` (IN `p_employee_id` INT, IN `p_start` DATETIME, IN `p_end` DATETIME, IN `p_exclude_appt_id` INT)   BEGIN
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

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(11) NOT NULL,
  `client_user_id` int(11) NOT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `service_id` int(11) NOT NULL,
  `start_datetime` datetime NOT NULL,
  `end_datetime` datetime NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `appointments`
--

INSERT INTO `appointments` (`id`, `client_user_id`, `employee_id`, `service_id`, `start_datetime`, `end_datetime`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, NULL, 1, '2025-11-22 08:30:00', '2025-11-22 10:30:00', 'pending', '', '2025-11-14 16:46:42', '2025-11-14 16:46:42'),
(2, 1, NULL, 4, '2025-11-21 14:00:00', '2025-11-21 15:30:00', 'pending', 'zzertyu', '2025-11-14 20:13:03', '2025-11-14 20:13:03');

-- --------------------------------------------------------

--
-- Table structure for table `appointment_history`
--

CREATE TABLE `appointment_history` (
  `id` int(11) NOT NULL,
  `appointment_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `changed_by` int(11) DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `hire_date` date DEFAULT NULL,
  `note` text DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `appointment_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `channel` enum('email','sms') NOT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `attempts` tinyint(4) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `appointment_id`, `user_id`, `channel`, `subject`, `body`, `scheduled_at`, `sent_at`, `status`, `attempts`, `created_at`) VALUES
(1, 1, 1, 'email', 'Confirmation de rendez-vous', 'Votre rendez-vous a été confirmé pour le 22/11/2025 à 09:30', '2025-11-14 17:46:42', '2025-11-14 17:50:00', 'sent', 0, '2025-11-14 16:46:42'),
(2, 2, 1, 'email', 'Confirmation de rendez-vous', 'Votre rendez-vous a été confirmé pour le 21/11/2025 à 15:00', '2025-11-14 21:13:04', '2025-11-14 21:15:00', 'sent', 0, '2025-11-14 20:13:04');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_at`) VALUES
(1, 'client', 'client', '2025-11-14 14:18:44'),
(2, 'admin', 'admin', '2025-11-14 14:18:44');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `duration_minutes` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `image` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `name`, `description`, `duration_minutes`, `price`, `is_active`, `created_at`, `updated_at`, `image`) VALUES
(1, 'Coupe Femme', 'la coupe des femmes', 60, 25000.00, 1, '2025-11-14 16:45:55', '2025-11-14 19:35:00', '/public/Coupe Femme/IMG-20251103-WA0047.jpg'),
(2, 'coupe Homme', 'la coupe des Hommes', 60, 10000.00, 1, '2025-11-14 16:45:55', '2025-11-14 19:35:00', '/public/Coupe Homme/IMG-20251103-WA0054.jpg'),
(3, 'coloration', 'coloration des cheveux', 60, 20000.00, 1, '2025-11-14 16:45:55', '2025-11-14 19:35:00', '/public/coloration/IMG-20251103-WA0043.jpg'),
(4, 'Brushimg', 'brushing des cheveux', 30, 15000.00, 1, '2025-11-14 16:45:55', '2025-11-14 19:35:00', '/public/brushing/IMG-20251114-WA0024.jpg'),
(5, 'Tresses', 'tresses des cheveux', 60, 10000.00, 1, '2025-11-14 16:45:55', '2025-11-14 19:35:00', '/public/Tresses/IMG-20251114-WA0020.jpg'),
(6, 'Soin Capillaire', 'soin des cheveux', 30, 8000.00, 1, '2025-11-14 16:45:55', '2025-11-14 19:35:00', '/public/Soin Capilaire/IMG-20251114-WA0041.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `role_id`, `email`, `password_hash`, `first_name`, `last_name`, `phone`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 'gwenkoundji@gmail.com', '$2a$12$u8ZZZ36pX.RFW6yTRKH3Ve1W1AoAMgxRWF.fmKFih7g.dc/mtErpC', 'tessa', 'legada', '0799886655', 1, '2025-11-14 14:18:56', '2025-11-14 14:18:56'),
(2, 2, 'yannmpombou@gmail.com', '$2a$12$lsOH3t6dWEQ/vJLNToWGz.Ghb4DF0r8kjpZUCDDK3b.7nMTb4ZUg.', 'yann', 'MPOMBOU', '066813542', 1, '2025-11-14 14:23:19', '2025-11-14 14:23:50');

-- --------------------------------------------------------

--
-- Table structure for table `working_hours`
--

CREATE TABLE `working_hours` (
  `id` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `jour_semaine` tinyint(4) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_appt_service` (`service_id`),
  ADD KEY `idx_appt_employee` (`employee_id`),
  ADD KEY `idx_appt_client` (`client_user_id`),
  ADD KEY `idx_appt_start` (`start_datetime`),
  ADD KEY `idx_appt_status` (`status`);

--
-- Indexes for table `appointment_history`
--
ALTER TABLE `appointment_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ah_appt` (`appointment_id`),
  ADD KEY `fk_ah_user` (`changed_by`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_notif_appt` (`appointment_id`),
  ADD KEY `fk_notif_user` (`user_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_users_role` (`role_id`);

--
-- Indexes for table `working_hours`
--
ALTER TABLE `working_hours`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wh_emp_day` (`employee_id`,`jour_semaine`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `appointment_history`
--
ALTER TABLE `appointment_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `working_hours`
--
ALTER TABLE `working_hours`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
