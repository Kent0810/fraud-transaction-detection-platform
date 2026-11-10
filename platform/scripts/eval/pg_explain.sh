#!/usr/bin/env bash
# PostgreSQL query plans for the backend's main queries: EXPLAIN (ANALYZE, BUFFERS), read-only.
# The same queries can be run on MySQL 8 with EXPLAIN ANALYZE to compare the two.
#   ./pg_explain.sh            (from platform/scripts/eval, with the stack running)
set -euo pipefail
cd "$(dirname "$0")/../.."

p() { docker compose exec -T postgres psql -U "${POSTGRES_USER:-db_user}" -d "${POSTGRES_DB:-db}" -X -At "$@"; }

# The busiest card and its latest transaction, so the plans run on real data.
CARD=$(p -c "SELECT card_id FROM transactions GROUP BY card_id ORDER BY count(*) DESC LIMIT 1")
TXN=$(p -c "SELECT txn_id FROM transactions WHERE card_id = '$CARD' ORDER BY created_at DESC LIMIT 1")

echo "rows: $(p -c "SELECT 'transactions=' || (SELECT count(*) FROM transactions) || '  ledger_entries=' || (SELECT count(*) FROM ledger_entries) || '  accounts=' || (SELECT count(*) FROM accounts) || '  audit_log=' || (SELECT count(*) FROM audit_log)")"
echo "card: $CARD ($(p -c "SELECT count(*) FROM transactions WHERE card_id = '$CARD'") transactions)"

queries=(
  "Q1 settle: one transaction by id|SELECT * FROM transactions WHERE txn_id = '$TXN'"
  "Q2 card's latest transactions|SELECT * FROM transactions WHERE card_id = '$CARD' ORDER BY created_at DESC LIMIT 50"
  "Q3 held transfers past due|SELECT * FROM transactions WHERE status = 'HELD' AND held_until < now()"
  "Q4 card's latest ledger entries|SELECT * FROM ledger_entries WHERE card_id = '$CARD' ORDER BY created_at DESC LIMIT 50"
  "Q5 card's audit trail|SELECT * FROM audit_log WHERE card_id = '$CARD' ORDER BY at DESC LIMIT 50"
  "Q6 balances that differ from the ledger|SELECT a.card_id FROM accounts a JOIN (SELECT card_id, sum(amount) s FROM ledger_entries GROUP BY card_id) l USING (card_id) WHERE a.balance <> l.s"
)

for entry in "${queries[@]}"; do
  name=${entry%%|*}
  sql=${entry#*|}
  p -c "$sql" > /dev/null # warm the cache, so the plan shows the steady state
  echo
  echo "### $name"
  echo "$sql"
  p -c "EXPLAIN (ANALYZE, BUFFERS) $sql"
done
