CREATE SEQUENCE IF NOT EXISTS transfer_reference_seq;

CREATE TABLE IF NOT EXISTS transfers (
  transfer_id   uuid PRIMARY KEY,
  reference     text NOT NULL UNIQUE DEFAULT 'FT' || lpad(nextval('transfer_reference_seq')::text, 10, '0'),
  from_card     text NOT NULL REFERENCES accounts (card_id) ON DELETE RESTRICT,
  to_bank_code  text NOT NULL,
  to_account    text NOT NULL,
  to_name       text NOT NULL,
  to_card       text REFERENCES accounts (card_id) ON DELETE RESTRICT,
  amount        bigint NOT NULL CHECK (amount > 0),
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (to_card IS NULL OR to_card <> from_card)
);

CREATE INDEX IF NOT EXISTS transfers_from_idx ON transfers (from_card, created_at DESC);
CREATE INDEX IF NOT EXISTS transfers_to_idx ON transfers (to_card, created_at DESC) WHERE to_card IS NOT NULL;

-- Written in the same transaction as the transfer, so an event exists exactly when the money moved.
-- Debezium reads it from the WAL and publishes to Kafka (wal_level=logical is already on).
CREATE TABLE IF NOT EXISTS outbox (
  event_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_id  text NOT NULL,
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only: rows can be inserted and read, never changed or removed, whichever role is connected.
-- A mistake is fixed with a new, reversing entry.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS ledger_entries_no_change ON ledger_entries; -- Drop first to make sure the migration is safe to run again
CREATE TRIGGER ledger_entries_no_change BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

DROP TRIGGER IF EXISTS ledger_entries_no_truncate ON ledger_entries;
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

-- Transfers are history too.
DROP TRIGGER IF EXISTS transfers_no_change ON transfers;
CREATE TRIGGER transfers_no_change BEFORE UPDATE OR DELETE ON transfers
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

DROP TRIGGER IF EXISTS transfers_no_truncate ON transfers;
CREATE TRIGGER transfers_no_truncate BEFORE TRUNCATE ON transfers
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();
