# /// script
# requires-python = ">=3.12"
# dependencies = ["cassandra-driver==3.29.2"]
# ///
"""NFR7: reading one card's history from txn_by_card (target 3 s).

  uv run cassandra_read.py [cards]
Times both the first page the app shows (20 rows) and the full 90-day partition.
"""
import random
import sys
import time

from cassandra.cluster import Cluster
from cassandra.query import SimpleStatement

from common import CASSANDRA_HOST, report

n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
session = Cluster([CASSANDRA_HOST]).connect("fraud")

cards = [r.card_id for r in session.execute("SELECT DISTINCT card_id FROM txn_by_card")]
cards = random.sample(cards, min(n, len(cards)))
page = session.prepare("SELECT * FROM txn_by_card WHERE card_id=? LIMIT 20")
full = SimpleStatement("SELECT * FROM txn_by_card WHERE card_id=%s", fetch_size=500)

first_page, whole, rows = [], [], []
for card in cards:
    t = time.perf_counter()
    list(session.execute(page, (card,)))
    first_page.append((time.perf_counter() - t) * 1000)

    t = time.perf_counter()
    rows.append(len(list(session.execute(full, (card,)))))  # follows every page
    whole.append((time.perf_counter() - t) * 1000)

report("NFR7 first page (20 rows)", first_page, target_ms=3000)
report("NFR7 full 90-day history", whole, target_ms=3000)
print(f"rows per card: avg {sum(rows) / len(rows):.0f}, max {max(rows)}")
