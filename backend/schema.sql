-- Contest QR system schema.
-- Run this using a PostgreSQL account that can create tables in the target database.

CREATE TABLE IF NOT EXISTS contestants (
  id integer PRIMARY KEY,
  description text,
  prize varchar(200),
  outcome varchar(20) CHECK (outcome IN ('winner', 'not_winner') OR outcome IS NULL),
  notes text,
  qr_path text,
  used_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'admin',
  auth_version integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_scan_window (
  id integer PRIMARY KEY CHECK (id = 1),
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at)
);

INSERT INTO ticket_scan_window (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
