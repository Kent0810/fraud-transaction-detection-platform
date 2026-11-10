#!/usr/bin/env bash
# Starts a throwaway MongoDB 8.0 container (WiredTiger cache 1 GB, the same as Cassandra's 1 GB heap),
# runs mongo_compare.py against it and the live Cassandra, then removes the container.
#   ./mongo_compare.sh [cards] [writes]
set -euo pipefail
cd "$(dirname "$0")"
export UV_EXCLUDE_NEWER="${UV_EXCLUDE_NEWER:-$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)}"
trap 'docker rm -f eval-mongo >/dev/null 2>&1 || true' EXIT

docker run -d --rm --name eval-mongo -p 27018:27017 mongo:8.0.13 --wiredTigerCacheSizeGB 1 >/dev/null
until docker exec eval-mongo mongosh --quiet --eval 'db.runCommand({ping: 1}).ok' >/dev/null 2>&1; do sleep 1; done
echo "versions: Cassandra $(cd ../.. && docker compose exec -T cassandra cqlsh -e 'SELECT release_version FROM system.local' </dev/null | sed -n 4p | tr -d ' ') vs MongoDB $(docker exec eval-mongo mongod --version | sed -n 's/db version v//p')"
uv run -q mongo_compare.py "${1:-200}" "${2:-5000}"
