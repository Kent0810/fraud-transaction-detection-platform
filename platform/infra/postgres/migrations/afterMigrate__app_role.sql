-- A Flyway callback, not a versioned migration: it runs after every migrate, so the password stays in sync with the
-- environment and abtles added by later migrations get their grants here. ${app_user} and ${app_password} are Flyway
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

-- Read only: balances, ledger entries, transfers and outbox events are written by post_transfer() alone.
-- No grant at all on outbox; Debezium reads it with its own replication login.
GRANT SELECT ON accounts TO "${app_user}";
GRANT SELECT ON ledger_entries TO "${app_user}";
GRANT SELECT ON transfers TO "${app_user}";
GRANT EXECUTE ON FUNCTION post_transfer(text, text, uuid, text, text, text, bigint, text) TO "${app_user}";

GRANT SELECT, INSERT, DELETE ON saved_recipients TO "${app_user}";
GRANT UPDATE (name) ON saved_recipients TO "${app_user}";
