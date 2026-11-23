ALTER TABLE users ADD COLUMN bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 240);

CREATE TABLE profile_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot text NOT NULL CHECK (slot IN ('avatar', 'cover')),
    content_type text NOT NULL CHECK (content_type IN (
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'
    )),
    data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 8388608),
    UNIQUE (owner_id, slot)
);
