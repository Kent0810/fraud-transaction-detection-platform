# /// script
# requires-python = ">=3.12"
# dependencies = ["google-cloud-bigquery==3.46.2"]
# ///
"""NFR13: the report reader (Metabase's key) reaches fraud_mart only, and no personal data is there.
  uv run bq_privacy.py
"""
from pathlib import Path

from google.api_core.exceptions import Forbidden
from google.cloud import bigquery

PERSONAL = {"first_name", "last_name", "email", "street", "dob", "job", "gender"}  # cardholders columns in PostgreSQL
client = bigquery.Client.from_service_account_json(Path(__file__).resolve().parents[2] / "secrets" / "gcp-sa-reporting.json")

for sql in ["SELECT COUNT(*) FROM fraud_raw.decisions", "SELECT COUNT(*) FROM fraud_mart.fact_transactions"]:
    try:
        n = next(iter(client.query(sql).result()))[0]
        print(f"{sql:52} -> allowed ({n:,} rows)")
    except Forbidden:
        print(f"{sql:52} -> 403 Access Denied")

found = set()
for t in client.list_tables("fraud_mart"):
    found |= PERSONAL & {f.name for f in client.get_table(t).schema}
print(f"personal columns in fraud_mart: {sorted(found) or 'none'} -> {'PASS' if not found else 'FAIL'}")
