-- Table pour stocker les images des services
CREATE TABLE IF NOT EXISTS service_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  image_order INT DEFAULT 0,
  is_primary TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_image_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_service_image_service (service_id),
  INDEX idx_service_image_order (service_id, image_order)
) ENGINE=InnoDB;

-- Table pour stocker les paramètres du site (image de fond, etc.)
CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Insérer l'image de fond par défaut
INSERT INTO site_settings (setting_key, setting_value) 
VALUES ('homepage_background_image', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

