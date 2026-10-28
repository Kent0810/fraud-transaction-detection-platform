-- A Flyway callback, not a versioned migration: it runs after every migrate, so the password stays in sync with the
-- environment and tables added by later migrations get their grants here. ${app_user} and ${app_password} are Flyway
-- placeholders (FLYWAY_PLACEHOLDERS_APP_USER / _APP_PASSWORD); Flyway refuses to run if either is missing.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${app_user}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN', '${app_user}');
  END IF;
  EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
                 '${app_user}', '${app_password}');
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

-- Money moves through postTransfer() in @platform/db: change a balance and append history, nothing more.
GRANT SELECT ON accounts TO "${app_user}";
GRANT UPDATE (balance, updated_at) ON accounts TO "${app_user}";
GRANT SELECT, INSERT ON ledger_entries TO "${app_user}";
GRANT SELECT, INSERT ON transfers TO "${app_user}";
GRANT USAGE ON SEQUENCE transfer_reference_seq TO "${app_user}";
GRANT INSERT ON outbox TO "${app_user}";

GRANT SELECT, INSERT, DELETE ON saved_recipients TO "${app_user}";
GRANT UPDATE (name) ON saved_recipients TO "${app_user}";
