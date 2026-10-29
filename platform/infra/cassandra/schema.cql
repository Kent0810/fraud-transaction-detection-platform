CREATE KEYSPACE IF NOT EXISTS fraud
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};   -- single node, dev only

USE fraud;

-- decisions topic (card payments) and transfers topic (app transfers)
CREATE TABLE IF NOT EXISTS txn_by_card (
  card_id               text,
  ts                    timestamp,
  txn_id                text,
  channel               text,
  merchant              text,
  counterparty_account  text,
  category              text,
  amount                decimal,
  currency              text,
  merch_lat             double,
  merch_long            double,
  decision              text,
  score                 double,
  fired_rules           set<text>,
  decided_at            timestamp,
  PRIMARY KEY ((card_id), ts, txn_id)
) WITH CLUSTERING ORDER BY (ts DESC, txn_id ASC)
  AND default_time_to_live = 7776000;   -- 90 days

-- alerts topic
CREATE TABLE IF NOT EXISTS alerts_by_card (
  card_id   text,
  ts        timestamp,
  alert_id  text,       -- txn_id:rule_id, so a replay overwrites instead of duplicating
  txn_id    text,
  rule_id   text,
  score     double,
  amount    decimal,
  status    text,       -- OPEN, CONFIRMED, CLEARED; not written by the sink yet
  PRIMARY KEY ((card_id), ts, alert_id)
) WITH CLUSTERING ORDER BY (ts DESC, alert_id ASC)
  AND default_time_to_live = 7776000;

-- cases topic
CREATE TABLE IF NOT EXISTS card_state (
  card_id        text PRIMARY KEY,
  risk_score     double,
  priority       double,
  amount_sum     decimal,
  open_alerts    int,
  last_decision  text,
  updated_at     timestamp
);

-- cases topic
CREATE TABLE IF NOT EXISTS triage_queue (
  bucket         text,   -- UTC day, e.g. 2026-10-20
  card_id        text,
  priority       double,
  risk_score     double,
  amount_sum     decimal,
  open_alerts    int,
  last_decision  text,
  updated_at     timestamp,
  PRIMARY KEY ((bucket), card_id)
) WITH default_time_to_live = 172800;   -- 2 days


-- control topic: current budget and merchant rules per card.
-- A RELEASE_MERCHANT event has every non-key column null, so the sink deletes the row.
CREATE TABLE IF NOT EXISTS controls_by_card (
  card_id        text,
  control_id     text,      -- 'budget' or 'merchant:<name>'
  kind           text,      -- BUDGET, MERCHANT
  merchant       text,
  rule           text,      -- BLOCK, ALLOW
  budget_limit   decimal,
  budget_period  text,      -- DAY, WEEK, MONTH
  updated_at     timestamp,
  PRIMARY KEY ((card_id), control_id)
);
