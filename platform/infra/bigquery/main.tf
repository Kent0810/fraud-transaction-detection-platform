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
      schema      = concat(jsondecode(file("${path.module}/datasets/fraud_raw/decisions.json")), local.kafka_meta)
    }
    settlements = {
      description = "settlements topic: whether the ledger posted or refused an approved transaction."
      clustering  = ["cc_num"]
      schema      = concat(jsondecode(file("${path.module}/datasets/fraud_raw/settlements.json")), local.kafka_meta)
    }
    alerts = {
      description = "alerts topic: one row per fired rule."
      clustering  = ["rule_id", "card_id"]
      schema      = concat(jsondecode(file("${path.module}/datasets/fraud_raw/alerts.json")), local.kafka_meta)
    }
    alert_reviews = {
      description = "Analyst CONFIRM_ALERT / CLEAR_ALERT rows from the Postgres audit_log."
      clustering  = ["txn_id"]
      schema      = concat(jsondecode(file("${path.module}/datasets/fraud_raw/alert_reviews.json")), local.file_meta)
    }
    ground_truth = {
      description = "ground_truth.csv: the dataset's is_fraud label per transaction, never sent through Kafka."
      clustering  = ["txn_id"]
      schema      = concat(jsondecode(file("${path.module}/datasets/fraud_raw/ground_truth.json")), local.file_meta)
    }
    dim_card = {
      description = "dim_card.csv: where each card lives. Names, addresses and birth dates are left out."
      clustering  = ["state"]
      schema      = concat(jsondecode(file("${path.module}/datasets/fraud_raw/dim_card.json")), local.file_meta)
    }
  }

  raw  = "${var.project_id}.${google_bigquery_dataset.raw.dataset_id}"
  mart = "${var.project_id}.${google_bigquery_dataset.mart.dataset_id}"

  # ${raw.<table>} and ${mart.<view>} in datasets/fraud_mart/*.sql, through the resources so a view waits for what it reads.
  raw_table_names = { for id, t in google_bigquery_table.raw : id => "${local.raw}.${t.table_id}" }
  mart_view_names = {
    fact_transactions = "${local.mart}.${google_bigquery_table.fact_transactions.table_id}"
    fact_labels       = "${local.mart}.${google_bigquery_table.fact_labels.table_id}"
    dim_card          = "${local.mart}.${google_bigquery_table.dim_card.table_id}"
  }
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
    query          = templatefile("${path.module}/datasets/fraud_mart/join_latest_decision_with_settlement.sql", { raw = local.raw_table_names })
  }
}

resource "google_bigquery_table" "fact_labels" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "fact_labels"
  description         = "Fraud label per transaction: the analyst's latest review wins over the dataset's ground truth."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = templatefile("${path.module}/datasets/fraud_mart/resolve_fraud_label.sql", { raw = local.raw_table_names })
  }
}

resource "google_bigquery_table" "dim_card" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "dim_card"
  description         = "One row per card; region = state."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = templatefile("${path.module}/datasets/fraud_mart/dedupe_card_locations.sql", { raw = local.raw_table_names })
  }
}

resource "google_bigquery_table" "fraud_loss_monthly" {
  dataset_id          = google_bigquery_dataset.mart.dataset_id
  table_id            = "fraud_loss_monthly"
  description         = "BR8: fraud loss by region, merchant category and month over the full history."
  deletion_protection = false

  view {
    use_legacy_sql = false
    query          = templatefile("${path.module}/datasets/fraud_mart/aggregate_monthly_fraud_loss.sql", { mart = local.mart_view_names })
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
