-- Opaque login sessions. The app holds the random token; only its SHA-256 is stored, so a leaked table can't be replayed.
-- Server-side (not a JWT) so logging out, or locking a card, ends the session at once.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  bytea PRIMARY KEY,
  card_id     text NOT NULL REFERENCES cardholders (card_id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_card_idx ON sessions (card_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);
