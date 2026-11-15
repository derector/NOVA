ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_subject text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_picture text;
CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_subject_idx ON users (telegram_subject) WHERE telegram_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS telegram_handoffs (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_handoffs_expiry_idx ON telegram_handoffs (expires_at);
