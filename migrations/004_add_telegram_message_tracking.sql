ALTER TABLE actual_free_game
ADD COLUMN title VARCHAR(512) NOT NULL DEFAULT '' AFTER server_type,
ADD COLUMN link TEXT NULL AFTER title,
ADD COLUMN chat_id VARCHAR(128) NULL AFTER discount_ends_at,
ADD COLUMN telegram_message_id BIGINT NULL AFTER chat_id,
ADD COLUMN telegram_message_kind ENUM('message', 'photo') NULL AFTER telegram_message_id,
ADD COLUMN status ENUM('active', 'deleted', 'ended', 'delete_failed', 'edit_failed') NOT NULL DEFAULT 'active' AFTER telegram_message_kind,
ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL AFTER status,
ADD COLUMN message_created_at TIMESTAMP NULL DEFAULT NULL AFTER last_seen_at,
ADD COLUMN ended_at TIMESTAMP NULL DEFAULT NULL AFTER message_created_at,
ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER ended_at,
ADD KEY idx_actual_free_game_status (status),
ADD KEY idx_actual_free_game_last_seen_at (last_seen_at);
