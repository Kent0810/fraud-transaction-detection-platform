# /// script
# requires-python = ">=3.12"
# dependencies = ["cassandra-driver==3.29.2"]
# ///
"""NFR10 on the serving store: does txn_by_card hold more than one row per transaction, and why?

txn_by_card's key is (card_id, ts, txn_id). A record the sink gets twice keeps its ts and overwrites its row;
a replay restarted from the beginning re-stamps ts, so each run adds one copy. Copies only minutes or hours apart
come from replay runs; copies seconds apart would mean the sink wrote a redelivered record twice.
  uv run cassandra_dupes.py
"""
from collections import defaultdict

from cassandra.cluster import Cluster
from cassandra.query import SimpleStatement

from common import CASSANDRA_HOST

session = Cluster([CASSANDRA_HOST]).connect("fraud")
stamps, rows = defaultdict(list), 0
for r in session.execute(SimpleStatement("SELECT card_id, ts, txn_id FROM txn_by_card", fetch_size=5000)):
    stamps[(r.card_id, r.txn_id)].append(r.ts)
    rows += 1

copies = defaultdict(int)
for ts in stamps.values():
    copies[len(ts)] += 1
gaps = sorted((b - a).total_seconds() for ts in stamps.values() for a, b in zip(sorted(ts), sorted(ts)[1:]))

print(f"rows {rows:,}, transactions (card, txn_id) {len(stamps):,}")
print("copies per transaction:", ", ".join(f"{n} copies: {c:,}" for n, c in sorted(copies.items())))
if gaps:
    close = sum(g < 60 for g in gaps)
    print(f"time between copies: min {gaps[0] / 60:.1f} min, median {gaps[len(gaps) // 2] / 60:.0f} min; "
          f"under 60 s apart: {close} -> {'PASS: copies come from replay runs only' if close == 0 else 'FAIL'}")
