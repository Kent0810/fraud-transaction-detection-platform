WITH gt AS (
  SELECT txn_id, is_fraud FROM `${raw.ground_truth}`
  WHERE TRUE
  QUALIFY ROW_NUMBER() OVER (PARTITION BY txn_id ORDER BY _loaded_at DESC) = 1
),
analyst AS (
  SELECT txn_id, status = 'CONFIRMED' AS is_fraud, staff_id, reviewed_at
  FROM `${raw.alert_reviews}`
  WHERE TRUE
  QUALIFY ROW_NUMBER() OVER (PARTITION BY txn_id ORDER BY reviewed_at DESC) = 1
)
SELECT
  txn_id,
  gt.is_fraud AS ground_truth_fraud,
  a.is_fraud AS analyst_fraud,
  a.staff_id AS reviewed_by,
  a.reviewed_at,
  COALESCE(a.is_fraud, gt.is_fraud) AS is_fraud,
  CASE WHEN a.is_fraud IS NOT NULL THEN 'ANALYST' WHEN gt.is_fraud IS NOT NULL THEN 'GROUND_TRUTH' END AS label_source
FROM gt FULL OUTER JOIN analyst AS a USING (txn_id)
