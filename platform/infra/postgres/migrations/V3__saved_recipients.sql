CREATE TABLE IF NOT EXISTS saved_recipients (
  card_id     text NOT NULL REFERENCES cardholders (card_id) ON DELETE CASCADE,
  bank_code   text NOT NULL,
  account     text NOT NULL,
  name        text NOT NULL,                  -- as the lookup returned it when saved
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, bank_code, account)
);
