#!/usr/bin/env bash
# Rebuilds prisma/schema.prisma from the Flyway migrations on a throwaway Postgres. --check: exit 1 if it's out of date.
set -euo pipefail

cd "$(dirname "$0")/.."
migrations="$(cd ../../infra/postgres/migrations && pwd)"
mode="${1:-}"

run="prisma-pull-$$"
cleanup() {
  docker rm -f "$run-pg" >/dev/null 2>&1 || true
  docker network rm "$run" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$run" >/dev/null
docker run -d --name "$run-pg" --network "$run" -p 127.0.0.1::5432 \
  -e POSTGRES_USER=owner -e POSTGRES_PASSWORD=owner -e POSTGRES_DB=db postgres:17 -c wal_level=logical >/dev/null
until docker exec "$run-pg" pg_isready -h 127.0.0.1 -U owner -d db -q; do sleep 1; done

docker run --rm --network "$run" -v "$migrations:/flyway/migrations:ro" \
  -e FLYWAY_URL="jdbc:postgresql://$run-pg:5432/db" -e FLYWAY_USER=owner -e FLYWAY_PASSWORD=owner \
  -e FLYWAY_LOCATIONS=filesystem:/flyway/migrations \
  -e FLYWAY_PLACEHOLDERS_APP_USER=app -e FLYWAY_PLACEHOLDERS_APP_PASSWORD=app \
  -e FLYWAY_PLACEHOLDERS_DEBEZIUM_USER=debezium -e FLYWAY_PLACEHOLDERS_DEBEZIUM_PASSWORD=debezium \
  flyway/flyway:13.8.1 -q migrate

port="$(docker port "$run-pg" 5432/tcp | head -1 | sed 's/.*://')"
export DATABASE_URL="postgresql://owner:owner@127.0.0.1:$port/db"

if [ "$mode" = "--check" ]; then
  # --print adds trailing blank lines the written file doesn't have.
  trim() { awk 'NF { for (; n > 0; n--) print ""; print; next } { n++ }'; }
  if ! diff -u <(trim < prisma/schema.prisma) <(npx prisma db pull --print | trim); then
    echo "prisma/schema.prisma is out of date with infra/postgres/migrations: run 'npm run pull' in packages/db" >&2
    exit 1
  fi
  echo "prisma/schema.prisma matches the migrations"
else
  npx prisma db pull
fi
