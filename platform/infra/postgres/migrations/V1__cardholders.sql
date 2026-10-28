CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cardholders (
  card_id     text PRIMARY KEY,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  email       text NOT NULL,
  gender      char(1),
  street      text,
  city        text,
  state       char(2),
  zip         text,
  lat         double precision,
  long        double precision,
  city_pop    integer,
  job         text,
  dob         date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Create unique index on email and index on name
CREATE UNIQUE INDEX IF NOT EXISTS cardholders_email_key ON cardholders (lower(email));
CREATE INDEX IF NOT EXISTS cardholders_name_idx ON cardholders (lower(last_name), lower(first_name));

CREATE TABLE IF NOT EXISTS auth (
  card_id              text PRIMARY KEY REFERENCES cardholders (card_id) ON DELETE CASCADE, -- if CardHolder delete, also delete authentication for it
  password_hash        text NOT NULL,         -- bcrypt via crypt(); (currently use same value for all account)
  status               text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
  last_login_at        timestamptz,
  password_changed_at  timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_inactive_idx ON auth (status) WHERE status <> 'ACTIVE'; -- partial index on status to search for user status fast
