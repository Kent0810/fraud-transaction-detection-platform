CREATE SEQUENCE IF NOT EXISTS transfer_reference_seq;

-- Just for safety right?
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
  status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'POSTED', 'DECLINED')),
  declined_for  text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  CONSTRAINT transfers_declined_check CHECK ((status = 'DECLINED') = (cardinality(declined_for) > 0)),
  CONSTRAINT transfers_decided_check CHECK ((status = 'PENDING') = (decided_at IS NULL))
);

CREATE INDEX IF NOT EXISTS transfers_from_idx ON transfers (from_card, created_at DESC);
CREATE INDEX IF NOT EXISTS transfers_to_idx ON transfers (to_card, created_at DESC) WHERE to_card IS NOT NULL;
CREATE INDEX IF NOT EXISTS transfers_pending_idx ON transfers (created_at) WHERE status = 'PENDING';

-- A TRANSFER entry belongs to a transfer: one per card, -amount for the sender, +amount for the recipient.
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_reference_fkey
  FOREIGN KEY (reference) REFERENCES transfers (reference) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_transfer_key ON ledger_entries (reference, card_id) WHERE reference IS NOT NULL;

-- function 1
CREATE OR REPLACE FUNCTION check_ledger_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  t transfers%ROWTYPE;
BEGIN
  SELECT * INTO t FROM transfers WHERE reference = NEW.reference;
  IF NOT coalesce(t.status = 'POSTED' AND (NEW.card_id = t.from_card AND NEW.amount = -t.amount
                  OR NEW.card_id = t.to_card AND NEW.amount = t.amount), false) THEN
    RAISE EXCEPTION '% on card % does not match transfer %', NEW.amount, NEW.card_id, NEW.reference
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ledger_entries_match_transfer ON ledger_entries;
CREATE TRIGGER ledger_entries_match_transfer BEFORE INSERT ON ledger_entries
  FOR EACH ROW WHEN (NEW.reference IS NOT NULL) EXECUTE FUNCTION check_ledger_entry();

-- function 2
CREATE OR REPLACE FUNCTION check_transfer_posted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(*) FROM ledger_entries WHERE reference = NEW.reference)
       <> (CASE WHEN NEW.status <> 'POSTED' THEN 0 WHEN NEW.to_card IS NULL THEN 1 ELSE 2 END) -- <> is !=
     OR NOT EXISTS (SELECT 1 FROM outbox
                    WHERE aggregate_id = NEW.from_card
                      AND type = CASE NEW.status WHEN 'PENDING' THEN 'TransferRequested'
                                                 WHEN 'POSTED' THEN 'TransferPosted'
                                                 ELSE 'TransferDeclined' END
                      AND payload ->> 'txn_id' = NEW.transfer_id::text) THEN
    RAISE EXCEPTION 'transfer % (%) has no matching ledger entries or outbox event', NEW.reference, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS transfers_posted ON transfers;
CREATE CONSTRAINT TRIGGER transfers_posted AFTER INSERT OR UPDATE ON transfers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_transfer_posted();

-- function 3
CREATE OR REPLACE FUNCTION check_transfer_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING' OR NEW.status = 'PENDING'
     OR to_jsonb(NEW) - '{status,declined_for,decided_at}'::text[]
        <> to_jsonb(OLD) - '{status,declined_for,decided_at}'::text[] THEN
    RAISE EXCEPTION 'transfer % is % and can only be decided once', OLD.reference, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

-- create a function to forbid change to the ledger
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
DROP TRIGGER IF EXISTS transfers_decided_once ON transfers;
CREATE TRIGGER transfers_decided_once BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION check_transfer_decision();

DROP TRIGGER IF EXISTS transfers_no_change ON transfers;
CREATE TRIGGER transfers_no_change BEFORE DELETE ON transfers
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

DROP TRIGGER IF EXISTS transfers_no_truncate ON transfers;
CREATE TRIGGER transfers_no_truncate BEFORE TRUNCATE ON transfers
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

-- A frozen account can't send money; it can still receive.
CREATE OR REPLACE FUNCTION forbid_frozen_sender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status <> 'DECLINED' AND EXISTS (SELECT 1 FROM accounts WHERE card_id = NEW.from_card AND status = 'FROZEN') THEN
    RAISE EXCEPTION 'account % is frozen', NEW.from_card USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS transfers_not_frozen ON transfers;
CREATE TRIGGER transfers_not_frozen BEFORE INSERT OR UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION forbid_frozen_sender();
