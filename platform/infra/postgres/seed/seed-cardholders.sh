#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_HOST:?POSTGRES_HOST is not set}"
: "${POSTGRES_PORT:?POSTGRES_PORT is not set}"
: "${POSTGRES_DB:?POSTGRES_DB is not set}"
: "${POSTGRES_USER:?POSTGRES_USER is not set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set}"

: "${CARD_HOLDER_FILE:?CARD_HOLDER_FILE is not set}"
: "${DEMO_PASSWORD:?DEMO_PASSWORD is not set}"

export PGPASSWORD="$POSTGRES_PASSWORD"

# One session, one transaction (-1). \copy reads the CSV on this side, so it can't use psql variables:
# the path is expanded by bash in the -c line instead.
psql -v ON_ERROR_STOP=1 -1 \
  --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v password="$DEMO_PASSWORD" \
  -c "CREATE TEMP TABLE dim_card (
        cc_num text, first text, last text, gender text, street text, city text, state text, zip text,
        lat double precision, long double precision, city_pop integer, job text, dob date)" \
  -c "\copy dim_card FROM '$CARD_HOLDER_FILE' WITH (FORMAT csv, HEADER match)" \
  -f - <<'SQL'
-- The dataset has no email: first.last@example.com, plus the card's last 4 digits when the name repeats.
INSERT INTO cardholders (card_id, first_name, last_name, email, gender, street, city, state, zip,
                         lat, long, city_pop, job, dob)
SELECT cc_num, first, last,
       lower(first || '.' || last)
         || CASE WHEN row_number() OVER (PARTITION BY lower(first || '.' || last) ORDER BY cc_num) > 1
                 THEN '.' || right(cc_num, 4) ELSE '' END
         || '@example.com',
       gender, street, city, state, zip, lat, long, city_pop, job, dob
FROM dim_card
ON CONFLICT (card_id) DO UPDATE SET
  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email,
  gender = EXCLUDED.gender, street = EXCLUDED.street, city = EXCLUDED.city, state = EXCLUDED.state,
  zip = EXCLUDED.zip, lat = EXCLUDED.lat, long = EXCLUDED.long, city_pop = EXCLUDED.city_pop,
  job = EXCLUDED.job, dob = EXCLUDED.dob, updated_at = now();

-- Hashes only the cards that have no login yet, so reruns stay fast. Cost 8: login verifies at the same cost.
INSERT INTO auth (card_id, password_hash)
SELECT c.card_id, crypt(:'password', gen_salt('bf', 8))
FROM cardholders c
WHERE NOT EXISTS (SELECT 1 FROM auth l WHERE l.card_id = c.card_id);

SELECT count(*) AS cardholders FROM cardholders;
SQL
