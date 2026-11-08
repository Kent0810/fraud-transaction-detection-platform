SELECT
  DATE_TRUNC(DATE(t.ts), MONTH) AS month,
  COALESCE(c.region, 'UNKNOWN') AS region,
  t.category,
  COUNT(*) AS txns,
  SUM(t.amount) AS volume,
  COUNTIF(l.is_fraud) AS fraud_txns,
  SUM(IF(l.is_fraud AND t.money_moved, t.amount, 0)) AS fraud_loss,
  SUM(IF(l.is_fraud AND NOT t.money_moved, t.amount, 0)) AS fraud_prevented,
  SUM(IF(l.analyst_fraud AND t.money_moved, t.amount, 0)) AS analyst_confirmed_loss,
  SUM(IF(l.ground_truth_fraud AND t.money_moved, t.amount, 0)) AS ground_truth_loss,
  COUNTIF(l.analyst_fraud = FALSE) AS false_positives
FROM `${mart.fact_transactions}` AS t
LEFT JOIN `${mart.fact_labels}` AS l USING (txn_id)
LEFT JOIN `${mart.dim_card}` AS c USING (card_id)
GROUP BY month, region, category
