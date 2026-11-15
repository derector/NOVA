CREATE TABLE IF NOT EXISTS chat_notification_preferences (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  muted_until timestamptz,
  preview_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS chat_notification_preferences_active_mute_idx
  ON chat_notification_preferences (chat_id, muted_until)
  WHERE muted_until IS NOT NULL;
