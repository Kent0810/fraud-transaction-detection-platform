CREATE TABLE IF NOT EXISTS sessions (
  token_hash  bytea PRIMARY KEY,
  card_id     text NOT NULL REFERENCES cardholders (card_id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_card_idx ON sessions (card_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);
