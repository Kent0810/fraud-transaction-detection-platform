-- A Flyway callback, not a versioned migration: it runs after every migrate, so the passwords stay in sync with the
-- environment and tables added by later migrations get their grants here. ${app_user}, ${app_password},
-- ${debezium_user} and ${debezium_password} are Flyway placeholders (FLYWAY_PLACEHOLDERS_*); Flyway refuses to run if
-- one is missing.

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
END $$;

-- Start from nothing, then grant table by table.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${app_user}";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${app_user}";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "${app_user}";
REVOKE CREATE ON SCHEMA public FROM "${app_user}";
GRANT USAGE ON SCHEMA public TO "${app_user}";

-- Profiles are written by the seed only.
GRANT SELECT ON cardholders TO "${app_user}";

-- Login reads the hash and records the login time; it can't change a password or unlock a card.
GRANT SELECT ON auth TO "${app_user}";
GRANT UPDATE (last_login_at) ON auth TO "${app_user}";

GRANT SELECT, INSERT, DELETE ON sessions TO "${app_user}";

-- Money moves through @platform/db: append history, nothing more. Balances follow the ledger.
-- The only column the app writes is status: freeze and unfreeze, together with the outbox event.
GRANT SELECT ON accounts TO "${app_user}";
GRANT UPDATE (status) ON accounts TO "${app_user}";
GRANT SELECT, INSERT ON ledger_entries TO "${app_user}";
GRANT SELECT, INSERT ON transfers TO "${app_user}";
GRANT UPDATE (status, declined_for, decided_at) ON transfers TO "${app_user}";
GRANT USAGE ON SEQUENCE transfer_reference_seq TO "${app_user}";
GRANT INSERT ON outbox TO "${app_user}";

GRANT SELECT, INSERT, DELETE ON saved_recipients TO "${app_user}";
GRANT UPDATE (name) ON saved_recipients TO "${app_user}";

-- Staff accounts are written by the seed only; the console signs them in and appends to the audit log.
GRANT SELECT ON staff TO "${app_user}";
GRANT SELECT, INSERT, DELETE ON staff_sessions TO "${app_user}";
GRANT SELECT, INSERT ON audit_log TO "${app_user}";

-- Debezium reads the outbox (the snapshot on first start, then the WAL) and no other table.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${debezium_user}";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${debezium_user}";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM "${debezium_user}";
REVOKE CREATE ON SCHEMA public FROM "${debezium_user}";
GRANT USAGE ON SCHEMA public TO "${debezium_user}";
GRANT SELECT ON outbox TO "${debezium_user}";
