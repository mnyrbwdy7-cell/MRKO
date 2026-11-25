export const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memorization (
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('learning','review','mastered')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (surah, ayah)
);

CREATE TABLE IF NOT EXISTS recitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_key TEXT NOT NULL,
  end_key TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  accuracy REAL NOT NULL DEFAULT 0,
  words INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  transcript TEXT NOT NULL DEFAULT '',
  audio_uri TEXT,
  offline INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recitation_id INTEGER,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  expected TEXT NOT NULL,
  actual TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  mastered INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_reviewed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mistakes_active ON mistakes(mastered, due_at);
CREATE INDEX IF NOT EXISTS idx_recitations_date ON recitations(started_at);

CREATE TABLE IF NOT EXISTS quiz_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS review_days (
  day TEXT PRIMARY KEY,
  goal INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
);
`;

export const DB_NAME = "rattil.db";
