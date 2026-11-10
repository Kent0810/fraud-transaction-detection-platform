# /// script
# requires-python = ">=3.12"
# dependencies = ["cassandra-driver==3.29.2", "pymongo==4.15.1"]
# ///
"""Cassandra vs MongoDB as the serving store, on the same rows and the same access pattern.

Copies every row of fraud.txn_by_card into MongoDB (index {card_id: 1, ts: -1}), then for the same
random cards times what the app does: the first page (20 newest rows) and the whole 90-day history.
Writes are timed one row at a time, like the sink, into a scratch table / collection that is
dropped at the end, so the live txn_by_card is only read.
Run through mongo_compare.sh, which starts and removes the MongoDB container.
  uv run mongo_compare.py [cards] [writes]
"""
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from cassandra.cluster import Cluster
from cassandra.query import SimpleStatement
from pymongo import ASCENDING, DESCENDING, MongoClient

from common import CASSANDRA_HOST, report

n_cards = int(sys.argv[1]) if len(sys.argv) > 1 else 200
n_writes = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
MONGO_URL = "mongodb://localhost:27018"

cass = Cluster([CASSANDRA_HOST]).connect("fraud")
mongo = MongoClient(MONGO_URL)
coll = mongo.fraud.txn_by_card


def doc(r):
    d = r._asdict()
    for k, v in d.items():
        if isinstance(v, Decimal):
            d[k] = float(v)
        elif isinstance(v, (set, frozenset)) or type(v).__name__ == "SortedSet":
            d[k] = sorted(v)
    return d


# 1. Copy the table.
t = time.perf_counter()
coll.drop()
batch, copied = [], 0
for r in cass.execute(SimpleStatement("SELECT * FROM txn_by_card", fetch_size=5000)):
    batch.append(doc(r))
    if len(batch) == 5000:
        coll.insert_many(batch, ordered=False)
        copied += len(batch)
        batch = []
if batch:
    coll.insert_many(batch, ordered=False)
    copied += len(batch)
coll.create_index([("card_id", ASCENDING), ("ts", DESCENDING)])
print(f"copied {copied:,} rows of txn_by_card into MongoDB in {time.perf_counter() - t:.0f} s "
      f"(index {{card_id: 1, ts: -1}})")

# 2. Reads: same cards, same order, warm caches first.
cards = random.sample([r.card_id for r in cass.execute("SELECT DISTINCT card_id FROM txn_by_card")], n_cards)
page_c = cass.prepare("SELECT * FROM txn_by_card WHERE card_id=? LIMIT 20")
full_c = SimpleStatement("SELECT * FROM txn_by_card WHERE card_id=%s", fetch_size=500)
since = datetime.now(timezone.utc) - timedelta(days=90)


def mongo_page(card):
    return list(coll.find({"card_id": card}).sort("ts", DESCENDING).limit(20))


def mongo_full(card):
    return list(coll.find({"card_id": card, "ts": {"$gte": since}}).sort("ts", DESCENDING))


for card in cards:  # warm-up
    list(cass.execute(full_c, (card,)))
    mongo_full(card)

timings = {k: [] for k in ("cp", "cf", "mp", "mf")}
for card in cards:
    for key, fn in (("cp", lambda: list(cass.execute(page_c, (card,)))),
                    ("cf", lambda: list(cass.execute(full_c, (card,)))),
                    ("mp", lambda: mongo_page(card)),
                    ("mf", lambda: mongo_full(card))):
        t = time.perf_counter()
        fn()
        timings[key].append((time.perf_counter() - t) * 1000)

print()
report("Cassandra first page (20 rows)", timings["cp"])
report("MongoDB   first page (20 rows)", timings["mp"])
report("Cassandra full 90-day history ", timings["cf"])
report("MongoDB   full 90-day history ", timings["mf"])

# 3. Writes, one row at a time like the sink, into scratch storage.
cass.execute("CREATE TABLE IF NOT EXISTS eval_write_bench (card_id text, ts timestamp, txn_id text, "
             "amount decimal, decision text, PRIMARY KEY (card_id, ts, txn_id)) WITH CLUSTERING ORDER BY (ts DESC, txn_id ASC)")
scratch = mongo.fraud.eval_write_bench
scratch.drop()
scratch.create_index([("card_id", ASCENDING), ("ts", DESCENDING)])
ins = cass.prepare("INSERT INTO eval_write_bench (card_id, ts, txn_id, amount, decision) VALUES (?, ?, ?, ?, ?)")
rows = [(random.choice(cards), datetime.now(timezone.utc) - timedelta(seconds=i), uuid.uuid4().hex, Decimal("12345"), "ALLOW")
        for i in range(n_writes)]
wc, wm = [], []
for card, ts, txn, amount, decision in rows:
    t = time.perf_counter()
    cass.execute(ins, (card, ts, txn, amount, decision))
    wc.append((time.perf_counter() - t) * 1000)
    t = time.perf_counter()
    scratch.insert_one({"card_id": card, "ts": ts, "txn_id": txn, "amount": float(amount), "decision": decision})
    wm.append((time.perf_counter() - t) * 1000)
cass.execute("DROP TABLE eval_write_bench")
scratch.drop()

print()
report(f"Cassandra single-row write ({n_writes:,})", wc)
report(f"MongoDB   single-row write ({n_writes:,})", wm)
print(f"write throughput, one client: Cassandra {n_writes / (sum(wc) / 1000):,.0f}/s, "
      f"MongoDB {n_writes / (sum(wm) / 1000):,.0f}/s")
