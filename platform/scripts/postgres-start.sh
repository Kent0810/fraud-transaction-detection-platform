#!/usr/bin/env bash
set -euo pipefail

exec docker-entrypoint.sh postgres \
  -c wal_level=logical \
  -c max_replication_slots=4 \
  -c max_wal_senders=4
