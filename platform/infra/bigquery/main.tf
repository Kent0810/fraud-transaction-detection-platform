locals {
  sandbox_expiration_ms = 60 * 24 * 60 * 60 * 1000

  kafka_meta = [
    { name = "_kafka_partition", type = "INT64", mode = "REQUIRED" },
    { name = "_kafka_offset", type = "INT64", mode = "REQUIRED" },
    { name = "_loaded_at", type = "TIMESTAMP", mode = "REQUIRED" },
  ]
  file_meta = [
    { name = "_loaded_at", type = "TIMESTAMP", mode = "REQUIRED" },
  ]

  raw_tables = {
    decisions = {
      description = "decisions topic: one verdict per card payment or transfer."
      clustering  = ["category", "card_id"]
      schema = concat([
        { name = "txn_id", type = "STRING", mode = "REQUIRED" },
        { name = "card_id", type = "STRING", mode = "REQUIRED" },
        { name = "ts", type = "TIMESTAMP", mode = "REQUIRED" },
        { name = "channel", type = "STRING", mode = "NULLABLE" },
        { name = "merchant", type = "STRING", mode = "NULLABLE" },
        { name = "recipient_account", type = "STRING", mode = "NULLABLE" },
        { name = "category", type = "STRING", mode = "NULLABLE" },
        { name = "amount", type = "INT64", mode = "REQUIRED" },
        { name = "currency", type = "STRING", mode = "NULLABLE" },
        { name = "merch_lat", type = "FLOAT64", mode = "NULLABLE" },
        { name = "merch_long", type = "FLOAT64", mode = "NULLABLE" },
        { name = "decision", type = "STRING", mode = "REQUIRED" },
        { name = "score", type = "FLOAT64", mode = "NULLABLE" },
        { name = "fired_rules", type = "STRING", mode = "REPEATED" },
        { name = "decided_at", type = "TIMESTAMP", mode = "NULLABLE" },
      ], local.kafka_meta)
    }
    settlements = {
      description = "settlements topic: whether the ledger posted or refused an approved transaction."
      clustering  = ["cc_num"]
      schema = concat([
        { name = "txn_id", type = "STRING", mode = "REQUIRED" },
        { name = "ts", type = "TIMESTAMP", mode = "REQUIRED" },
        { name = "cc_num", type = "STRING", mode = "REQUIRED" },
        { name = "channel", type = "STRING", mode = "NULLABLE" },
        { name = "amt", type = "INT64", mode = "REQUIRED" },
        { name = "status", type = "STRING", mode = "REQUIRED" },
        { name = "declined_for", type = "STRING", mode = "REPEATED" },
      ], local.kafka_meta)
    }
    alerts = {
      description = "alerts topic: one row per fired rule."
      clustering  = ["rule_id", "card_id"]
      schema = concat([
        { name = "card_id", type = "STRING", mode = "REQUIRED" },
        { name = "txn_id", type = "STRING", mode = "REQUIRED" },
        { name = "rule_id", type = "STRING", mode = "REQUIRED" },
        { name = "score", type = "FLOAT64", mode = "NULLABLE" },
        { name = "amount", type = "INT64", mode = "NULLABLE" },
        { name = "ts", type = "TIMESTAMP", mode = "REQUIRED" },
      ], local.kafka_meta)
    }
    alert_reviews = {
      description = "Analyst CONFIRM_ALERT / CLEAR_ALERT rows from the Postgres audit_log."
      clustering  = ["txn_id"]
      schema = concat([
        { name = "audit_id", type = "INT64", mode = "REQUIRED" },
        { name = "card_id", type = "STRING", mode = "REQUIRED" },
        { name = "alert_id", type = "STRING", mode = "REQUIRED" },
        { name = "txn_id", type = "STRING", mode = "REQUIRED" },
        { name = "status", type = "STRING", mode = "REQUIRED" },
        { name = "staff_id", type = "INT64", mode = "NULLABLE" },
        { name = "reason", type = "STRING", mode = "NULLABLE" },
        { name = "reviewed_at", type = "TIMESTAMP", mode = "REQUIRED" },
      ], local.file_meta)
    }
    ground_truth = {
      description = "ground_truth.csv: the dataset's is_fraud label per transaction, never sent through Kafka."
      clustering  = ["txn_id"]
      schema = concat([
        { name = "txn_id", type = "STRING", mode = "REQUIRED" },
        { name = "is_fraud", type = "BOOL", mode = "REQUIRED" },
      ], local.file_meta)
    }
    dim_card = {
      description = "dim_card.csv: where each card lives. Names, addresses and birth dates are left out."
      clustering  = ["state"]
      schema = concat([
        { name = "card_id", type = "STRING", mode = "REQUIRED" },
        { name = "city", type = "STRING", mode = "NULLABLE" },
        { name = "state", type = "STRING", mode = "NULLABLE" },
        { name = "zip", type = "STRING", mode = "NULLABLE" },
        { name = "lat", type = "FLOAT64", mode = "NULLABLE" },
        { name = "long", type = "FLOAT64", mode = "NULLABLE" },
        { name = "city_pop", type = "INT64", mode = "NULLABLE" },
      ], local.file_meta)
    }
  }

  raw  = "${var.project_id}.${google_bigquery_dataset.raw.dataset_id}"
  mart = "${var.project_id}.${google_bigquery_dataset.mart.dataset_id}"
}

resource "google_project_service" "apis" {
  for_each           = toset(["cloudresourcemanager.googleapis.com", "bigquery.googleapis.com", "iam.googleapis.com"])
  service            = each.value
  disable_on_destroy = false
}

resource "google_bigquery_dataset" "raw" {
  dataset_id                      = "fraud_raw"
  location                        = var.location
  description                     = "Landing tables: Kafka topics, the audit log and the dataset's side files, as loaded."
  default_table_expiration_ms     = var.sandbox ? local.sandbox_expiration_ms : null
  default_partition_expiration_ms = var.sandbox ? local.sandbox_expiration_ms : null
  delete_contents_on_destroy      = true

  depends_on = [google_project_service.apis]
}

resource "google_bigquery_dataset" "mart" {
  dataset_id                      = "fraud_mart"
  location                        = var.location
  description                     = "Views for reporting (BR8). Readers get this dataset only."
  default_table_expiration_ms     = var.sandbox ? local.sandbox_expiration_ms : null
  default_partition_expiration_ms = var.sandbox ? local.sandbox_expiration_ms : null
  delete_contents_on_destroy      = true

  depends_on = [google_project_service.apis]
}

resource "google_bigquery_table" "raw" {
  for_each            = local.raw_tables
  dataset_id          = google_bigquery_dataset.raw.dataset_id
  table_id            = each.key
  description         = each.value.description
  clustering          = each.value.clustering
  schema              = jsonencode(each.value.schema)
  deletion_protection = false
}

resource "google_bigquery_table" "fact_transactions" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "fact_transactions"
  description         = "Latest decision per transaction with its settlement; money_moved is false when it was declined or refused."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH d AS (
        SELECT * FROM `${local.raw}.${google_bigquery_table.raw["decisions"].table_id}`
        WHERE TRUE
        QUALIFY ROW_NUMBER() OVER (PARTITION BY txn_id ORDER BY _kafka_offset DESC) = 1
      ),
      s AS (
        SELECT txn_id, status, declined_for FROM `${local.raw}.${google_bigquery_table.raw["settlements"].table_id}`
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
    SQL
  }
}

resource "google_bigquery_table" "fact_labels" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "fact_labels"
  description         = "Fraud label per transaction: the analyst's latest review wins over the dataset's ground truth."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      WITH gt AS (
        SELECT txn_id, is_fraud FROM `${local.raw}.${google_bigquery_table.raw["ground_truth"].table_id}`
        WHERE TRUE
        QUALIFY ROW_NUMBER() OVER (PARTITION BY txn_id ORDER BY _loaded_at DESC) = 1
      ),
      analyst AS (
        SELECT txn_id, status = 'CONFIRMED' AS is_fraud, staff_id, reviewed_at
        FROM `${local.raw}.${google_bigquery_table.raw["alert_reviews"].table_id}`
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
    SQL
  }
}

resource "google_bigquery_table" "dim_card" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "dim_card"
  description         = "One row per card; region = state."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
      SELECT card_id, city, state AS region, zip, lat, long, city_pop
      FROM `${local.raw}.${google_bigquery_table.raw["dim_card"].table_id}`
      WHERE TRUE
      QUALIFY ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY _loaded_at DESC) = 1
    SQL
  }
}

resource "google_bigquery_table" "fraud_loss_monthly" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "fraud_loss_monthly"
  description         = "BR8: fraud loss by region, merchant category and month over the full history."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = <<-SQL
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
      FROM `${local.mart}.${google_bigquery_table.fact_transactions.table_id}` AS t
      LEFT JOIN `${local.mart}.${google_bigquery_table.fact_labels.table_id}` AS l USING (txn_id)
      LEFT JOIN `${local.mart}.${google_bigquery_table.dim_card.table_id}` AS c USING (card_id)
      GROUP BY month, region, category
    SQL
  }
}

resource "google_bigquery_dataset_access" "authorized_views" {
  for_each = {
    fact_transactions = google_bigquery_table.fact_transactions.table_id
    fact_labels       = google_bigquery_table.fact_labels.table_id
    dim_card          = google_bigquery_table.dim_card.table_id
  }
  dataset_id = google_bigquery_dataset.raw.dataset_id

  view {
    project_id = var.project_id
    dataset_id = google_bigquery_dataset.mart.dataset_id
    table_id   = each.value
  }
}

resource "google_service_account" "loader" {
  account_id   = "fraud-batch-loader"
  display_name = "Batch loader: Kafka and side files into fraud_raw"
  depends_on   = [google_project_service.apis]
}

resource "google_service_account" "reporting" {
  account_id   = "fraud-reporting"
  display_name = "Reporting: reads fraud_mart (Metabase)"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "job_user" {
  for_each = {
    loader    = google_service_account.loader.email
    reporting = google_service_account.reporting.email
  }
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${each.value}"
}

resource "google_bigquery_dataset_access" "loader_writes_raw" {
  dataset_id    = google_bigquery_dataset.raw.dataset_id
  role          = "WRITER"
  user_by_email = google_service_account.loader.email
}

resource "google_bigquery_dataset_access" "reporting_reads_mart" {
  dataset_id    = google_bigquery_dataset.mart.dataset_id
  role          = "READER"
  user_by_email = google_service_account.reporting.email
}

resource "google_service_account_key" "keys" {
  for_each = var.write_key_files ? {
    "gcp-sa.json"           = google_service_account.loader.name
    "gcp-sa-reporting.json" = google_service_account.reporting.name
  } : {}
  service_account_id = each.value
}

resource "local_sensitive_file" "keys" {
  for_each        = google_service_account_key.keys
  filename        = "${path.module}/${var.key_dir}/${each.key}"
  content         = base64decode(each.value.private_key)
  file_permission = "0600"
}
