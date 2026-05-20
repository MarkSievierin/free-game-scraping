CREATE TABLE IF NOT EXISTS actual_free_game (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(512) NOT NULL,
  type ENUM('steam', 'gog', 'epic') NOT NULL,
  discount_ends_at VARCHAR(255) NOT NULL DEFAULT '',
  UNIQUE KEY uq_actual_free_game_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
