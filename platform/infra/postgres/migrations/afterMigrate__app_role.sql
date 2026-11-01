-- A Flyway callback, not a versioned migration: it runs after every migrate, so the passwords stay in sync with the
-- environment and tables added by later migrations get their grants here. ${app_user}, ${app_password},
-- ${debezium_user}, ${debezium_password}, ${notifier_user}, ${notifier_password}, ${loader_user} and
-- ${loader_password} are Flyway placeholders
-- (FLYWAY_PLACEHOLDERS_*); Flyway refuses to run if one is missing.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${app_user}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN', '${app_user}');
  END IF;
  EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
                 '${app_user}', '${app_password}');

  -- Debezium's login: logical replication of the outbox, nothing else.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${debezium_user}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN', '${debezium_user}');
  END IF;
  EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE REPLICATION NOBYPASSRLS PASSWORD %L',
                 '${debezium_user}', '${debezium_password}');

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${notifier_user}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN', '${notifier_user}');
  END IF;
  EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
                 '${notifier_user}', '${notifier_password}');

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${loader_user}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN', '${loader_user}');
  END IF;
  EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
                 '${loader_user}', '${loader_password}');
END $$;

-- Start from nothing, then grant table by table.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${app_user}";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${app_user}";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "${app_user}";
REVOKE CREATE ON SCHEMA public FROM "${app_user}";
GRANT USAGE ON SCHEMA public TO "${app_user}";

-- Profiles are written by the seed only.
GRANT SELECT ON cardholders TO "${app_user}";

-- Login reads the hash, records the login time and counts wrong passwords, locking the login at the limit. Agents
-- turn a login off and on from the console. Nothing here can change a password.
GRANT SELECT ON auth TO "${app_user}";
GRANT UPDATE (last_login_at, failed_logins, status) ON auth TO "${app_user}";

GRANT SELECT, INSERT, DELETE ON sessions TO "${app_user}";

-- Money moves through @platform/db: append history, nothing more. Balances follow the ledger.
-- The only column the app writes is status: freeze and unfreeze, together with the outbox event.
GRANT SELECT ON accounts TO "${app_user}";
GRANT UPDATE (status) ON accounts TO "${app_user}";
GRANT SELECT, INSERT ON ledger_entries TO "${app_user}";
GRANT SELECT, INSERT ON transactions TO "${app_user}";
GRANT UPDATE (status, declined_for, decided_at, held_until) ON transactions TO "${app_user}";
GRANT USAGE ON SEQUENCE transaction_reference_seq TO "${app_user}";
GRANT INSERT ON outbox TO "${app_user}";

GRANT SELECT, INSERT, DELETE ON saved_recipients TO "${app_user}";
GRANT UPDATE (name) ON saved_recipients TO "${app_user}";

-- Staff accounts are written by the seed only; the console signs them in and appends to the audit log.
GRANT SELECT ON staff TO "${app_user}";
GRANT SELECT, INSERT, DELETE ON staff_sessions TO "${app_user}";
GRANT SELECT, INSERT ON audit_log TO "${app_user}";

-- An analyst opens a follow-up, an agent records how the call went; it's never deleted.
GRANT SELECT, INSERT ON fraud_followups TO "${app_user}";
GRANT UPDATE (status, resolved_by, resolved_at, note) ON fraud_followups TO "${app_user}";
-- An agent adds a fraud mark, an analyst removes it.
GRANT SELECT, INSERT, DELETE ON recipient_fraud_marks TO "${app_user}";

-- Debezium reads the outbox (the snapshot on first start, then the WAL) and no other table.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${debezium_user}";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${debezium_user}";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "${debezium_user}";
REVOKE CREATE ON SCHEMA public FROM "${debezium_user}";
GRANT USAGE ON SCHEMA public TO "${debezium_user}";
GRANT SELECT ON outbox TO "${debezium_user}";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${notifier_user}";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${notifier_user}";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "${notifier_user}";
REVOKE CREATE ON SCHEMA public FROM "${notifier_user}";
GRANT USAGE ON SCHEMA public TO "${notifier_user}";
GRANT SELECT ON sessions, auth, cardholders, staff, staff_sessions, transactions TO "${notifier_user}";

-- The BigQuery batch loader copies analyst reviews out of the audit log, nothing else.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${loader_user}";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${loader_user}";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "${loader_user}";
REVOKE CREATE ON SCHEMA public FROM "${loader_user}";
GRANT USAGE ON SCHEMA public TO "${loader_user}";
GRANT SELECT ON audit_log TO "${loader_user}";
