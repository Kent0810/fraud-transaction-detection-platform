-- Bank staff who sign in to the operations console: analysts work the triage queue, agents handle cardholder calls.
CREATE TABLE IF NOT EXISTS staff (
  staff_id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          text NOT NULL,
  name           text NOT NULL,
  role           text NOT NULL CHECK (role IN ('ANALYST', 'AGENT')),
  password_hash  text NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_email_key ON staff (lower(email));

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash  bytea PRIMARY KEY,
  staff_id    integer NOT NULL REFERENCES staff (staff_id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_sessions_staff_idx ON staff_sessions (staff_id);

-- Every look at a cardholder's details and every change staff make, written before the change takes effect.
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id  integer NOT NULL REFERENCES staff (staff_id) ON DELETE RESTRICT,
  action    text NOT NULL CHECK (action IN ('VIEW_CARDHOLDER', 'BLOCK_MERCHANT', 'ALLOW_MERCHANT', 'RELEASE_MERCHANT',
                                             'FREEZE_CARD', 'UNFREEZE_CARD', 'CONFIRM_ALERT', 'CLEAR_ALERT')),
  card_id   text NOT NULL REFERENCES cardholders (card_id) ON DELETE RESTRICT,
  payload   jsonb NOT NULL DEFAULT '{}',
  at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_card_idx ON audit_log (card_id, at DESC);

CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$;

DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
