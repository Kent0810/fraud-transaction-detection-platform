CREATE SEQUENCE IF NOT EXISTS account_number_seq;

CREATE TABLE IF NOT EXISTS accounts (
  card_id         text PRIMARY KEY REFERENCES cardholders (card_id) ON DELETE CASCADE,
  account_number  text NOT NULL UNIQUE DEFAULT '1903' || lpad(nextval('account_number_seq')::text, 8, '0'),
  currency        char(3) NOT NULL DEFAULT 'VND',
  balance         bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),   -- kept by apply_ledger_entry(), never written directly
  status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN')),  -- the cardholder can freeze it, e.g. after losing the card
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id     text NOT NULL REFERENCES accounts (card_id) ON DELETE RESTRICT,  -- history outlives the account; close it instead
  kind       text NOT NULL CHECK (kind IN ('OPENING', 'TRANSFER')),
  amount      bigint NOT NULL,                        -- signed: + into the account, - out of it
  reference   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_sign_check CHECK (CASE kind WHEN 'TRANSFER' THEN amount <> 0 ELSE amount >= 0 END),
  CONSTRAINT ledger_entries_reference_check CHECK ((kind = 'TRANSFER') = (reference IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ledger_entries_card_idx ON ledger_entries (card_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_opening_key ON ledger_entries (card_id) WHERE kind = 'OPENING';

-- runs with the permissions of the owner of the function
CREATE OR REPLACE FUNCTION apply_ledger_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE accounts SET balance = balance + NEW.amount, updated_at = now() WHERE card_id = NEW.card_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS ledger_entries_apply ON ledger_entries;
CREATE TRIGGER ledger_entries_apply AFTER INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION apply_ledger_entry();
