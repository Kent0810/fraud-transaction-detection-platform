CREATE SEQUENCE IF NOT EXISTS account_number_seq;

CREATE TABLE IF NOT EXISTS accounts (
  card_id         text PRIMARY KEY REFERENCES cardholders (card_id) ON DELETE CASCADE,
  account_number  text NOT NULL UNIQUE DEFAULT '1903' || lpad(nextval('account_number_seq')::text, 8, '0'),
  currency        char(3) NOT NULL DEFAULT 'VND',
  balance         bigint NOT NULL CHECK (balance >= 0),   -- running total of ledger_entries, kept for fast reads
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id     text NOT NULL REFERENCES accounts (card_id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('OPENING', 'DEBIT', 'CREDIT')),
  amount      bigint NOT NULL,                        -- signed: + into the account, - out of it
  reference   text,                                   -- what caused it, e.g. a transfer id
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_card_idx ON ledger_entries (card_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_opening_key ON ledger_entries (card_id) WHERE kind = 'OPENING';
