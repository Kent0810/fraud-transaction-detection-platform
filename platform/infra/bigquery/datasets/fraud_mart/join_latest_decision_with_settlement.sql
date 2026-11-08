WITH d AS (
  SELECT * FROM `${raw.decisions}`
  WHERE TRUE
  QUALIFY ROW_NUMBER() OVER (PARTITION BY txn_id ORDER BY _kafka_offset DESC) = 1
),
s AS (
  SELECT txn_id, status, declined_for FROM `${raw.settlements}`
  WHERE TRUE
  QUALIFY ROW_NUMBER() OVER (PARTITION BY txn_id ORDER BY _kafka_offset DESC) = 1
)
SELECT
  d.txn_id, d.card_id, d.ts, d.channel, d.merchant, d.recipient_account,
  COALESCE(d.category, LOWER(d.channel)) AS category,
  d.amount, d.currency, d.decision, d.score, d.fired_rules,
  s.status AS settlement_status, s.declined_for,
  COALESCE(s.status = 'POSTED', d.decision != 'DECLINE') AS money_moved
FROM d LEFT JOIN s USING (txn_id)
