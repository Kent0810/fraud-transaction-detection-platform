CREATE SEQUENCE IF NOT EXISTS transaction_reference_seq;

-- Card payments and transfers share one table. Whatever the app sends (a transfer, or a card payment made in the app)
-- is requested (PENDING) and decided later; a card payment from the event source arrives already decided (POSTED or
-- DECLINED) and is recorded in one go.
CREATE TABLE IF NOT EXISTS transactions (
  txn_id        text PRIMARY KEY,   -- card payment ids are 32 hex characters, transfer ids are uuids
  reference     text NOT NULL UNIQUE DEFAULT 'FT' || lpad(nextval('transaction_reference_seq')::text, 10, '0'),
  card_id       text NOT NULL REFERENCES accounts (card_id) ON DELETE RESTRICT,
  channel       text NOT NULL CONSTRAINT transactions_channel_value_check CHECK (channel IN ('CARD', 'TRANSFER')),
  -- Card payments only: where the card was used. created_at is the time of the payment event.
  merchant      text,
  category      text,
  merch_lat     double precision,
  merch_long    double precision,
  -- Transfers only: to an account of this bank (to_card), or of another bank through NAPAS (to_bank, its bank id).
  -- Money sent to another bank leaves this bank: only the sender has a ledger entry.
  to_account    text,
  to_name       text,
  to_card       text REFERENCES accounts (card_id) ON DELETE RESTRICT,
  to_bank       text CHECK (to_bank ~ '^\d{6}$'),
  content       text,
  amount        bigint NOT NULL CHECK (amount > 0),
  status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'POSTED', 'DECLINED')),
  declined_for  text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  CONSTRAINT transactions_declined_check CHECK ((status = 'DECLINED') = (cardinality(declined_for) > 0)),
  CONSTRAINT transactions_decided_check CHECK ((status = 'PENDING') = (decided_at IS NULL)),
  CONSTRAINT transactions_channel_check CHECK (CASE channel
    WHEN 'TRANSFER' THEN to_account IS NOT NULL AND to_name IS NOT NULL AND content IS NOT NULL
                         AND (to_card IS NULL) <> (to_bank IS NULL)
    ELSE merchant IS NOT NULL AND to_card IS NULL AND to_bank IS NULL END)
);

CREATE INDEX IF NOT EXISTS transactions_card_idx ON transactions (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_to_idx ON transactions (to_card, created_at DESC) WHERE to_card IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_pending_idx ON transactions (created_at) WHERE status = 'PENDING';

-- Every entry except OPENING belongs to a transaction: -amount for the card, +amount for the recipient of a transfer
-- inside this bank.
ALTER TABLE ledger_entries
  DROP CONSTRAINT ledger_entries_kind_check,
  ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN ('OPENING', 'TRANSFER', 'CARD_PAYMENT')),
  DROP CONSTRAINT ledger_entries_sign_check,
  ADD CONSTRAINT ledger_entries_sign_check CHECK (CASE kind WHEN 'OPENING' THEN amount >= 0 ELSE amount <> 0 END),
  DROP CONSTRAINT ledger_entries_reference_check,
  ADD CONSTRAINT ledger_entries_reference_check CHECK ((kind = 'OPENING') = (reference IS NULL));
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_reference_fkey
  FOREIGN KEY (reference) REFERENCES transactions (reference) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_transfer_key ON ledger_entries (reference, card_id) WHERE reference IS NOT NULL;

-- function 1: an entry matches its posted transaction, and its kind matches the channel.
CREATE OR REPLACE FUNCTION check_ledger_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  t transactions%ROWTYPE;
BEGIN
  SELECT * INTO t FROM transactions WHERE reference = NEW.reference;
  IF NOT coalesce(t.status = 'POSTED'
                  AND NEW.kind = CASE t.channel WHEN 'CARD' THEN 'CARD_PAYMENT' ELSE 'TRANSFER' END
                  AND (NEW.card_id = t.card_id AND NEW.amount = -t.amount
                       OR NEW.card_id = t.to_card AND NEW.amount = t.amount), false) THEN
    RAISE EXCEPTION '% % on card % does not match transaction %', NEW.kind, NEW.amount, NEW.card_id, NEW.reference
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ledger_entries_match_transaction ON ledger_entries;
CREATE TRIGGER ledger_entries_match_transaction BEFORE INSERT ON ledger_entries
  FOR EACH ROW WHEN (NEW.reference IS NOT NULL) EXECUTE FUNCTION check_ledger_entry();

-- function 2: by commit, a transaction has its entries (one for a card payment, two for a transfer, none unless
-- POSTED) and the outbox event for its status.
CREATE OR REPLACE FUNCTION check_transaction_posted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(*) FROM ledger_entries WHERE reference = NEW.reference)
       <> (CASE WHEN NEW.status <> 'POSTED' THEN 0 WHEN NEW.to_card IS NULL THEN 1 ELSE 2 END) -- <> is !=
     OR NOT EXISTS (SELECT 1 FROM outbox
                    WHERE aggregate_id = NEW.card_id
                      AND type = CASE NEW.status WHEN 'PENDING' THEN 'TransactionRequested'
                                                 WHEN 'POSTED' THEN 'TransactionPosted'
                                                 ELSE 'TransactionDeclined' END
                      AND payload ->> 'txn_id' = NEW.txn_id) THEN
    RAISE EXCEPTION 'transaction % (%) has no matching ledger entries or outbox event', NEW.reference, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS transactions_posted ON transactions;
CREATE CONSTRAINT TRIGGER transactions_posted AFTER INSERT OR UPDATE ON transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_transaction_posted();

-- function 3: a PENDING transaction is decided once; nothing else about it changes.
CREATE OR REPLACE FUNCTION check_transaction_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING' OR NEW.status = 'PENDING'
     OR to_jsonb(NEW) - '{status,declined_for,decided_at}'::text[]
        <> to_jsonb(OLD) - '{status,declined_for,decided_at}'::text[] THEN
    RAISE EXCEPTION 'transaction % is % and can only be decided once', OLD.reference, OLD.status
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

-- Transactions are history too.
DROP TRIGGER IF EXISTS transactions_decided_once ON transactions;
CREATE TRIGGER transactions_decided_once BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_transaction_decision();

DROP TRIGGER IF EXISTS transactions_no_change ON transactions;
CREATE TRIGGER transactions_no_change BEFORE DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

DROP TRIGGER IF EXISTS transactions_no_truncate ON transactions;
CREATE TRIGGER transactions_no_truncate BEFORE TRUNCATE ON transactions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

-- A frozen account can't pay or send money; it can still receive. A declined transaction moves nothing.
-- A redelivered insert of a row that already exists passes: ON CONFLICT DO NOTHING skips it only after BEFORE INSERT
-- triggers have run, and refusing it would turn a replay into an error once the card is frozen.
CREATE OR REPLACE FUNCTION forbid_frozen_sender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM transactions WHERE txn_id = NEW.txn_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'DECLINED' AND EXISTS (SELECT 1 FROM accounts WHERE card_id = NEW.card_id AND status = 'FROZEN') THEN
    RAISE EXCEPTION 'account % is frozen', NEW.card_id USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS transactions_not_frozen ON transactions;
CREATE TRIGGER transactions_not_frozen BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_frozen_sender();

-- Card payments and transfers draw from the same sequence; a card payment's reference reads CP… instead of FT….
CREATE OR REPLACE FUNCTION set_card_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.reference := regexp_replace(NEW.reference, '^FT', 'CP');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS transactions_card_reference ON transactions;
CREATE TRIGGER transactions_card_reference BEFORE INSERT ON transactions
  FOR EACH ROW WHEN (NEW.channel = 'CARD') EXECUTE FUNCTION set_card_reference();
