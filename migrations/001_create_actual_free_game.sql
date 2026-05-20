CREATE TABLE IF NOT EXISTS actual_free_game (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('steam', 'gog', 'epic')),
  discount_ends_at TEXT NOT NULL DEFAULT ''
);
