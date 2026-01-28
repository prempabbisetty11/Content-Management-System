PRAGMA foreign_keys = ON;

-- =========================
-- TABLES (create if missing)
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','user')),
  username TEXT,
  blocked_until TEXT
);

CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media TEXT,
  media_original_name TEXT,
  media_mime TEXT,
  author TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  viewer_email TEXT NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
);

-- =========================
-- RESET USERS (your new list)
-- =========================
DELETE FROM users;

INSERT INTO users (id, email, password, role, username, blocked_until) VALUES
('231FA18154','231FA18154@gmail.com','231FA18154','user','231FA18154',NULL),
('231FA18146','231FA18146@gmail.com','231FA18146','user','231FA18146',NULL),
('231FA18149','231FA18149@gmail.com','231FA18149','user','231FA18149',NULL),
('231FA18121','231FA18121@gmail.com','231FA18121','user','231FA18121',NULL),
('231FA18106','231FA18106@gmail.com','231FA18106','user','231FA18106',NULL),
('231FA18141','231FA18141@gmail.com','231FA18141','user','231FA18141',NULL),
('admin','admin@gmail.com','admin','admin','admin',NULL);