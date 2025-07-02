-- Tabelle für Benutzer
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL
);

-- Tabelle für Strafen
CREATE TABLE IF NOT EXISTS penalties (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  event TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Standard-Admin anlegen
DELETE FROM users WHERE username = 'admin';
INSERT INTO users (username, password, role)
VALUES (
  'admin',
  '$2b$10$jUbne23MEI87JXFsD6Y1q.BczuWgB9GmbhjD7nWVs9MkijzE6Benu',
  'admin'
);
