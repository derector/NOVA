CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username varchar(32) NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  telegram_subject text UNIQUE,
  telegram_username varchar(64),
  telegram_picture text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(email)),
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,32}$')
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  email text PRIMARY KEY,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_challenges_expiry_idx ON otp_challenges (expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direct_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_members_user_idx ON chat_members (user_id, chat_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_message_id uuid NOT NULL,
  text varchar(10000) NOT NULL CHECK (length(text) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (chat_id, sender_id, client_message_id)
);
CREATE INDEX IF NOT EXISTS messages_chat_order_idx ON messages (chat_id, created_at, id);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key char(64) PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  hit_count integer NOT NULL CHECK (hit_count > 0)
);
CREATE INDEX IF NOT EXISTS rate_limit_window_idx ON rate_limit_buckets (window_started_at);
