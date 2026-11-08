# Metabase (risk dashboards)

Metabase reads the BigQuery `fraud_mart` views (BR8). It runs as `risk-dashboards` in `docker-compose.yml`, at
http://localhost:3001. Its own settings, users and dashboards live in the `metabase-data` volume: `docker compose down`
keeps them, `docker compose down -v` deletes them and you start from the setup wizard again.

Before this, apply the warehouse (`../bigquery/README.md`) so `secrets/gcp-sa-reporting.json` exists and the
batch-loader is filling `fraud_raw`.

## First run

1. Open http://localhost:3001 and create the admin user.
2. At **Add your data**, pick **I'll add my data later**. Errors at this step only show as a failed submit; the admin
   page below shows the real message.
3. **Admin settings → Databases → Add database → BigQuery**:

   | Field | Value |
   |---|---|
   | Display name | `Fraud mart` |
   | Service account JSON file | `secrets/gcp-sa-reporting.json` |
   | Datasets | **Only these…** → `fraud_mart` |

   Use the reporting key, not `gcp-sa.json`: it can only read `fraud_mart`, which is all Metabase needs.

4. Save, then wait for the first sync (the four views appear under **Browse data → Fraud mart**).

## What is in `fraud_mart`

| View | One row per | Use it for |
|---|---|---|
| `fact_transactions` | transaction, latest decision joined with its settlement | volumes, decisions, which rules fired (`fired_rules`), `money_moved` |
| `fact_labels` | labelled transaction | fraud or not: the analyst's review wins over the dataset's ground truth (`label_source`) |
| `dim_card` | card | where the cardholder lives (`city`, `region`, `lat`, `long`) |
| `fraud_loss_monthly` | month × region × category | fraud lost vs prevented, analyst-confirmed loss, false positives |

The queries are in `../bigquery/datasets/fraud_mart/`. Rule ids in `fired_rules` are the detector's R1–R7
(`Rules.java`); rows loaded before the renaming still carry the old names (`AMOUNT_SPIKE`, `FROZEN`, …).

## Useful questions

New → **SQL query**, database **Fraud mart**.

Fraud loss vs prevented per month:

```sql
SELECT month, SUM(fraud_loss) AS lost, SUM(fraud_prevented) AS prevented
FROM fraud_mart.fraud_loss_monthly
GROUP BY month
ORDER BY month
```

How often each rule fires, and how often it is right:

```sql
SELECT rule, COUNT(*) AS fired, COUNTIF(l.is_fraud) AS on_fraud,
       ROUND(SAFE_DIVIDE(COUNTIF(l.is_fraud), COUNT(*)), 3) AS hit_rate
FROM fraud_mart.fact_transactions AS t, UNNEST(t.fired_rules) AS rule
LEFT JOIN fraud_mart.fact_labels AS l USING (txn_id)
GROUP BY rule
ORDER BY fired DESC
```

Fraud that got through (approved, labelled fraud), largest first:

```sql
SELECT t.ts, t.card_id, t.merchant, t.category, t.amount, l.label_source
FROM fraud_mart.fact_transactions AS t
JOIN fraud_mart.fact_labels AS l USING (txn_id)
WHERE l.is_fraud AND t.money_moved
ORDER BY t.amount DESC
LIMIT 100
```

Save each as a question, then add them to one dashboard (**New → Dashboard**).

## Troubleshooting

- **Setup keeps failing (`POST /api/setup 400` in the logs):** the wizard rejected the form, usually the database
  step. Skip it as in step 2 and add BigQuery from the admin page.
- **No tables after adding the database:** the key is not the reporting one, or `terraform apply` has not run since
  the views changed. **Admin → Databases → Fraud mart → Sync database schema** after fixing.
- **Views are empty:** the batch-loader has not loaded yet (`docker compose logs batch-loader`); it loads every
  interval, a minute of topic data at a time.
- **Docker runs out of memory:** Metabase is a JVM and takes over 1 GB. Add `JAVA_OPTS: -Xmx512m` to
  `risk-dashboards`, or stop it while not using it (`docker compose stop risk-dashboards`).
