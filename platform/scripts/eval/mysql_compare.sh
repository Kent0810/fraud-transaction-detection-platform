#!/usr/bin/env bash
# PostgreSQL vs MySQL on the backend's main queries (the ones in pg_explain.sh).
# Copies transactions, ledger_entries, accounts and audit_log from the running PostgreSQL into a throwaway
# MySQL 8.4 container with the same columns and indexes, runs each query 5 times with EXPLAIN ANALYZE on
# both, and prints the median. Both use their default 128 MB buffer cache. The container is removed at the end.
#   ./mysql_compare.sh
set -euo pipefail
cd "$(dirname "$0")"
PLATFORM=$(cd ../.. && pwd)
WORK=$(mktemp -d)
trap 'docker rm -f eval-mysql >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

pg() { (cd "$PLATFORM" && docker compose exec -T postgres psql -U "${POSTGRES_USER:-db_user}" -d "${POSTGRES_DB:-db}" -X -At "$@") </dev/null; }
my() { docker exec eval-mysql mysql -uroot -peval db -N -r "$@" </dev/null 2>/dev/null; }
ts() { echo "to_char($1 AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US')"; }
csv() { pg -c "COPY ($2) TO STDOUT WITH (FORMAT csv, NULL '\N')" > "$WORK/$1.csv"; }

echo "starting MySQL 8.4.6 and copying data from PostgreSQL..."
docker run -d --rm --name eval-mysql -e MYSQL_ROOT_PASSWORD=eval -e MYSQL_DATABASE=db mysql:8.4.6 >/dev/null
csv transactions "SELECT txn_id, reference, card_id, channel, merchant, category, to_account, to_card, amount, status, array_to_json(declined_for), $(ts created_at), $(ts decided_at), $(ts held_until) FROM transactions"
csv ledger_entries "SELECT entry_id, card_id, kind, amount, reference, $(ts created_at) FROM ledger_entries"
csv accounts "SELECT card_id, account_number, balance, status FROM accounts"
csv audit_log "SELECT audit_id, staff_id, action, card_id, payload::text, $(ts at) FROM audit_log"
until my -e "SELECT 1" >/dev/null; do sleep 2; done

cat > "$WORK/schema.sql" <<'EOF'
-- MySQL has no partial index: transactions_held_idx becomes (status, held_until) over the whole table.
CREATE TABLE transactions (
  txn_id varchar(64) PRIMARY KEY, reference varchar(20) NOT NULL UNIQUE, card_id varchar(32) NOT NULL,
  channel varchar(16) NOT NULL, merchant varchar(255), category varchar(64), to_account varchar(64), to_card varchar(32),
  amount bigint NOT NULL, status varchar(16) NOT NULL, declined_for json NOT NULL,
  created_at datetime(6) NOT NULL, decided_at datetime(6), held_until datetime(6),
  INDEX transactions_card_idx (card_id, created_at DESC),
  INDEX transactions_held_idx (status, held_until));
CREATE TABLE ledger_entries (
  entry_id bigint PRIMARY KEY, card_id varchar(32) NOT NULL, kind varchar(16) NOT NULL, amount bigint NOT NULL,
  reference varchar(64), created_at datetime(6) NOT NULL,
  INDEX ledger_entries_card_idx (card_id, created_at DESC));
CREATE TABLE accounts (card_id varchar(32) PRIMARY KEY, account_number varchar(16) NOT NULL UNIQUE,
  balance bigint NOT NULL, status varchar(16) NOT NULL);
CREATE TABLE audit_log (
  audit_id bigint PRIMARY KEY, staff_id int NOT NULL, action varchar(64) NOT NULL, card_id varchar(32) NOT NULL,
  payload json NOT NULL, at datetime(6) NOT NULL, INDEX audit_log_card_idx (card_id, at DESC));
LOAD DATA INFILE '/var/lib/mysql-files/transactions.csv' INTO TABLE transactions FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"';
LOAD DATA INFILE '/var/lib/mysql-files/ledger_entries.csv' INTO TABLE ledger_entries FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"';
LOAD DATA INFILE '/var/lib/mysql-files/accounts.csv' INTO TABLE accounts FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"';
LOAD DATA INFILE '/var/lib/mysql-files/audit_log.csv' INTO TABLE audit_log FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '';
ANALYZE TABLE transactions, ledger_entries, accounts, audit_log;
EOF
docker cp "$WORK/." eval-mysql:/var/lib/mysql-files/ >/dev/null
docker exec -i eval-mysql mysql -uroot -peval db < "$WORK/schema.sql" >/dev/null 2>&1

CARD=$(pg -c "SELECT card_id FROM transactions GROUP BY card_id ORDER BY count(*) DESC LIMIT 1")
TXN=$(pg -c "SELECT txn_id FROM transactions WHERE card_id = '$CARD' ORDER BY created_at DESC LIMIT 1")
echo "rows: transactions=$(my -e 'SELECT count(*) FROM transactions')  ledger_entries=$(my -e 'SELECT count(*) FROM ledger_entries')  (same data in both)"
echo "versions: $(pg -c 'SHOW server_version') vs MySQL $(my -e 'SELECT @@version')"
echo

queries=(
  "Q1 one transaction by id|SELECT * FROM transactions WHERE txn_id = '$TXN'"
  "Q2 card's latest transactions|SELECT * FROM transactions WHERE card_id = '$CARD' ORDER BY created_at DESC LIMIT 50"
  "Q3 held transfers past due|SELECT * FROM transactions WHERE status = 'HELD' AND held_until < now()"
  "Q4 card's latest ledger entries|SELECT * FROM ledger_entries WHERE card_id = '$CARD' ORDER BY created_at DESC LIMIT 50"
  "Q5 card's audit trail|SELECT * FROM audit_log WHERE card_id = '$CARD' ORDER BY at DESC LIMIT 50"
  "Q6 balances vs ledger|SELECT a.card_id FROM accounts a JOIN (SELECT card_id, sum(amount) s FROM ledger_entries GROUP BY card_id) l USING (card_id) WHERE a.balance <> l.s"
)
median() { tr ' ' '\n' | grep -v '^$' | sort -g | sed -n 3p; }

printf '%-34s %14s %14s   %s\n' "query (median of 5, ms)" "PostgreSQL" "MySQL" "MySQL plan"
for entry in "${queries[@]}"; do
  name=${entry%%|*}; sql=${entry#*|}
  pg -c "$sql" >/dev/null; my -e "$sql" >/dev/null   # warm both caches
  p=""; m=""
  for _ in 1 2 3 4 5; do
    p="$p $(pg -c "EXPLAIN ANALYZE $sql" | sed -n 's/^Execution Time: \([0-9.]*\) ms/\1/p')"
    m="$m $(my -e "EXPLAIN ANALYZE $sql" | head -1 | sed -E 's/.*actual time=[^ ]*\.\.([0-9.e-]+) .*/\1/')"
  done
  plan=$(my -e "EXPLAIN ANALYZE $sql" | grep -o -E '(Index lookup|Index range scan|Index scan|Table scan|Rows fetched before execution)[^(]*' | tail -1 | cut -c1-60)
  printf '%-34s %14.3f %14.3f   %s\n' "$name" "$(echo "$p" | median)" "$(echo "$m" | median)" "$plan"
done

echo
echo "held-transfer index size: PostgreSQL $(pg -c "SELECT pg_size_pretty(pg_relation_size('transactions_held_idx'))") (partial: HELD rows only)" \
     "vs MySQL $(my -e "SELECT CONCAT(ROUND(stat_value*@@innodb_page_size/1048576,1),' MB') FROM mysql.innodb_index_stats WHERE table_name='transactions' AND index_name='transactions_held_idx' AND stat_name='size'") (every row)"
