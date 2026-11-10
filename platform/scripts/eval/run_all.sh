#!/usr/bin/env bash
# Runs the evaluation one section at a time, with clean output to screenshot for the report.
#   ./run_all.sh latency | throughput | correctness | sql | mysql | mongo | control
# `control` signs in as an agent (AGENT_EMAIL, AGENT_PASSWORD; defaults: the README demo agent) and freezes / unfreezes CARD 15 times each,
# leaving it unfrozen; each change adds rows to the append-only audit_log.
# `correctness` restarts the fraud-detector mid-replay (the NFR10 fault test); everything else is read-only.
set -euo pipefail
cd "$(dirname "$0")"
export UV_EXCLUDE_NEWER="${UV_EXCLUDE_NEWER:-$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)}"
SECRETS=../../secrets
psql_() { (cd ../.. && docker compose exec -T postgres psql -U "${POSTGRES_USER:-db_user}" -d "${POSTGRES_DB:-db}" -X "$@"); }
title() { printf '\n\033[1m$ %s\033[0m\n' "$*"; }

case "${1:-}" in
latency)
  title "uv run decision_latency.py 120";  uv run -q decision_latency.py 120
  title "uv run sink_latency.py 120 20";   uv run -q sink_latency.py 120 20
  title "uv run cassandra_read.py 200";    uv run -q cassandra_read.py 200
  title "uv run bigquery_eval.py 10"
  GOOGLE_APPLICATION_CREDENTIALS=$SECRETS/gcp-sa-reporting.json uv run -q bigquery_eval.py 10
  ;;
throughput)
  title "uv run throughput.py 180 15";     uv run -q throughput.py 180 15
  title "docker stats fraud-detector"
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | grep -E 'NAME|fraud-detector'
  ;;
correctness)
  title "docker compose restart fraud-detector   # $(date -u +%T) UTC, replay running"
  (cd ../.. && docker compose restart fraud-detector >/dev/null 2>&1)
  until (cd ../.. && docker compose logs --since 2m fraud-detector 2>&1) | grep -q 'REBALANCING -> RUNNING'; do sleep 2; done
  (cd ../.. && docker compose logs --since 2m --no-log-prefix fraud-detector 2>&1) | grep -E 'CREATED -> REBALANCING|REBALANCING -> RUNNING'
  title "uv run exactly_once.py";          uv run -q exactly_once.py
  title "balance vs ledger (psql)"
  psql_ -c "SELECT count(*) FILTER (WHERE a.balance <> coalesce(l.s, 0)) AS mismatched,
                   count(*) FILTER (WHERE a.balance < 0) AS negative, count(*) AS accounts
            FROM accounts a LEFT JOIN (SELECT card_id, sum(amount) s FROM ledger_entries GROUP BY card_id) l USING (card_id);"
  title "UPDATE / DELETE audit_log (psql, rolled back)"
  psql_ -c "BEGIN; UPDATE audit_log SET action = action WHERE audit_id = (SELECT min(audit_id) FROM audit_log); ROLLBACK;" 2>&1 | grep -E 'ERROR' || true
  psql_ -c "BEGIN; DELETE FROM audit_log WHERE audit_id = (SELECT min(audit_id) FROM audit_log); ROLLBACK;" 2>&1 | grep -E 'ERROR' || true
  title "uv run cassandra_dupes.py";        uv run -q cassandra_dupes.py
  title "uv run bq_dedupe.py";             uv run -q bq_dedupe.py
  title "uv run bq_privacy.py";            uv run -q bq_privacy.py
  ;;
sql)
  title "./pg_explain.sh"
  ./pg_explain.sh | grep -E '^(rows|card|###)|Scan using|Scan on|Index Cond|Hash Join|Workers Launched|Execution Time'
  ;;
mysql)
  title "./mysql_compare.sh";              ./mysql_compare.sh
  ;;
mongo)
  title "./mongo_compare.sh 200 5000";     ./mongo_compare.sh 200 5000
  ;;
control)
  API=${API:-http://localhost:8080}; CARD=${CARD:-180011453250192}
  TOKEN=$(curl -s -X POST "$API/ops/auth/login" -H 'content-type: application/json' \
    -d "{\"email\":\"${AGENT_EMAIL:-agent@hcmmb.vn}\",\"password\":\"${AGENT_PASSWORD:-admin1234}\"}" \
    | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])')
  title "TOKEN=<agent> uv run sse_latency.py ops 150   &   uv run control_latency.py 150"
  TOKEN=$TOKEN uv run -q sse_latency.py ops 150 > "$TMPDIR/nfr2.txt" 2>&1 &
  uv run -q control_latency.py 150 > "$TMPDIR/nfr3.txt" 2>&1 &
  sleep 15
  for _ in $(seq 15); do
    for action in freeze unfreeze; do
      curl -s -o /dev/null -X POST "$API/ops/cards/$CARD/$action" -H "Authorization: Bearer $TOKEN" \
        -H 'content-type: application/json' -d '{"reason":"NFR3 evaluation"}'
      sleep 3
    done
  done
  wait
  tail -1 "$TMPDIR/nfr2.txt"; tail -1 "$TMPDIR/nfr3.txt"
  ;;
*)
  echo "usage: $0 latency | throughput | correctness | sql | mysql | mongo | control" >&2; exit 2 ;;
esac
