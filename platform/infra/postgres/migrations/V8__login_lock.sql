-- Wrong passwords in a row; the fifth locks the login until an agent restores it. A good login resets it.
ALTER TABLE auth ADD COLUMN IF NOT EXISTS failed_logins integer NOT NULL DEFAULT 0 CHECK (failed_logins >= 0);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('VIEW_CARDHOLDER', 'BLOCK_MERCHANT', 'ALLOW_MERCHANT', 'RELEASE_MERCHANT', 'FREEZE_CARD',
                    'UNFREEZE_CARD', 'CONFIRM_ALERT', 'CLEAR_ALERT', 'DISABLE_LOGIN', 'RESTORE_LOGIN'));
