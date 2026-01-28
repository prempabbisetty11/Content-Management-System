-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin','user')),
  username VARCHAR(100),
  blocked_until TIMESTAMP
);

-- =========================
-- CONTENTS
-- =========================
CREATE TABLE IF NOT EXISTS contents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media TEXT,
  media_original_name TEXT,
  media_mime TEXT,
  author VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- CONTENT VIEWS
-- =========================
CREATE TABLE IF NOT EXISTS content_views (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  viewer_email VARCHAR(255) NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_content
    FOREIGN KEY (content_id)
    REFERENCES contents(id)
    ON DELETE CASCADE
);

-- =========================
-- RESET USERS
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