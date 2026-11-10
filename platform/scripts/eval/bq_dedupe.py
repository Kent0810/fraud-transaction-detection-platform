# /// script
# requires-python = ">=3.12"
# dependencies = ["google-cloud-bigquery==3.46.2"]
# ///
"""Reloading never double counts: raw rows (loaded more than once) vs rows after the mart's dedup.
Needs both keys: the loader's for fraud_raw, the reporting one for fraud_mart.
  uv run bq_dedupe.py
"""
from pathlib import Path

from google.cloud import bigquery

SECRETS = Path(__file__).resolve().parents[2] / "secrets"
raw = bigquery.Client.from_service_account_json(SECRETS / "gcp-sa.json")
mart = bigquery.Client.from_service_account_json(SECRETS / "gcp-sa-reporting.json")

for client, table in [(raw, "fraud_raw.decisions"), (mart, "fraud_mart.fact_transactions")]:
    sql = f"SELECT COUNT(*) AS n, COUNT(DISTINCT txn_id) AS d FROM {table}"
    r = next(iter(client.query(sql).result()))
    print(f"{table:30} rows={r.n:>9,}  distinct txn_id={r.d:>9,}")
