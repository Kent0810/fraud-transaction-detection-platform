# /// script
# requires-python = ">=3.12"
# dependencies = ["google-cloud-bigquery==3.46.2"]
# ///
"""NFR9: report query time (target 5 s) and data freshness (target 6 min).

  GOOGLE_APPLICATION_CREDENTIALS=../../secrets/gcp-sa-reporting.json uv run bigquery_eval.py [runs]
Run while the replay and the batch loader are running. Uses the reporting key, like Metabase:
it reads fraud_mart only.
"""
import os
import sys
import time
from datetime import datetime, timezone

from google.cloud import bigquery

from common import report

runs = int(sys.argv[1]) if len(sys.argv) > 1 else 10
client = bigquery.Client(project=os.environ.get("BQ_PROJECT") or None)
no_cache = bigquery.QueryJobConfig(use_query_cache=False)

times = []
for _ in range(runs):
    t = time.perf_counter()
    client.query("SELECT * FROM fraud_mart.fraud_loss_monthly", job_config=no_cache).result()
    times.append((time.perf_counter() - t) * 1000)
report("NFR9 fraud_loss_monthly query", times, target_ms=5000)

row = next(iter(client.query(
    "SELECT MAX(ts) AS newest FROM fraud_mart.fact_transactions", job_config=no_cache).result()))
lag_min = (datetime.now(timezone.utc) - row.newest).total_seconds() / 60
print(f"NFR9 freshness: newest decision in BigQuery is {lag_min:.1f} min old "
      f"-> {'PASS' if lag_min <= 6 else 'FAIL'} (target 6 min)")
