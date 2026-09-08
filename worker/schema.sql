CREATE TABLE IF NOT EXISTS sessions (
  owner_hash TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  case_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  object_key TEXT NOT NULL
);
