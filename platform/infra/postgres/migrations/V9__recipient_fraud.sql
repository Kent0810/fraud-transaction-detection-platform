-- An analyst confirmed a transaction as fraud: an agent now has to call the cardholder. One row per transaction, however
-- many of its alerts were confirmed. GENUINE: the cardholder made it. FRAUD: they didn't.
CREATE TABLE IF NOT EXISTS fraud_followups (
  card_id         text NOT NULL REFERENCES cardholders (card_id) ON DELETE RESTRICT,
  txn_id          text NOT NULL,
  txn_ts          timestamptz NOT NULL,        -- finds the transaction's alerts in Cassandra
  recipient_id    text NOT NULL,
  recipient_name  text NOT NULL,
  amount          bigint NOT NULL,
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENUINE', 'FRAUD')),
  confirmed_by    integer NOT NULL REFERENCES staff (staff_id) ON DELETE RESTRICT,
  confirmed_at    timestamptz NOT NULL DEFAULT now(),
  resolved_by     integer REFERENCES staff (staff_id) ON DELETE RESTRICT,
  resolved_at     timestamptz,
  note            text,
  PRIMARY KEY (card_id, txn_id)
);

CREATE INDEX IF NOT EXISTS fraud_followups_recent_idx ON fraud_followups (confirmed_at DESC);

-- Recipients a cardholder said they never paid, bank-wide. The same change goes to the fraud detector through the outbox;
-- this table is what the console lists. card_id and txn_id: the call that led to the mark.
CREATE TABLE IF NOT EXISTS recipient_fraud_marks (
  recipient_id    text PRIMARY KEY,
  recipient_name  text NOT NULL,
  card_id         text NOT NULL REFERENCES cardholders (card_id) ON DELETE RESTRICT,
  txn_id          text NOT NULL,
  marked_by       integer NOT NULL REFERENCES staff (staff_id) ON DELETE RESTRICT,
  marked_at       timestamptz NOT NULL DEFAULT now()
);

-- The merchant actions stay: old audit rows use them.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('VIEW_CARDHOLDER', 'BLOCK_MERCHANT', 'ALLOW_MERCHANT', 'RELEASE_MERCHANT', 'FREEZE_CARD',
                    'UNFREEZE_CARD', 'CONFIRM_ALERT', 'CLEAR_ALERT', 'DISABLE_LOGIN', 'RESTORE_LOGIN',
                    'BLOCK_RECIPIENT', 'ALLOW_RECIPIENT', 'RELEASE_RECIPIENT', 'CUSTOMER_GENUINE', 'CUSTOMER_FRAUD',
                    'REMOVE_FRAUD_MARK'));
