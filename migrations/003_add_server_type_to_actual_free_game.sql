ALTER TABLE actual_free_game
ADD COLUMN server_type ENUM('stage', 'prod') NOT NULL DEFAULT 'prod' AFTER type;

ALTER TABLE actual_free_game
DROP INDEX uq_actual_free_game_uuid,
ADD UNIQUE KEY uq_actual_free_game_server_type_uuid (server_type, uuid),
ADD KEY idx_actual_free_game_type (type),
ADD KEY idx_actual_free_game_server_type (server_type);
