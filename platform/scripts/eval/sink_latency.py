# /// script
# requires-python = ">=3.12"
# dependencies = ["confluent-kafka==2.15.1", "cassandra-driver==3.29.2"]
# ///
"""Part of NFR1 / NFR7: how long the Cassandra sink takes to land a decision.

WRITETIME cannot be used: the sink writes cells with the Kafka record's timestamp (the
transaction's event time), not the wall clock. So for a sample of decisions this polls
txn_by_card until the row's decision appears, and measures that moment minus decided_at.
NFR1 (case visible in the queue) = NFR6 + this + up to 5 s of console polling.

  uv run sink_latency.py [seconds] [sample_every]
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from cassandra.cluster import Cluster

from common import CASSANDRA_HOST, consumer, iso_to_epoch, poll_for, report

seconds = int(sys.argv[1]) if len(sys.argv) > 1 else 60
every = int(sys.argv[2]) if len(sys.argv) > 2 else 20
TIMEOUT_S = 30

session = Cluster([CASSANDRA_HOST]).connect("fraud")
q = session.prepare("SELECT decision FROM txn_by_card WHERE card_id=? AND ts=? AND txn_id=?")
pool = ThreadPoolExecutor(16)
futures, count = [], 0


def wait_for_row(card, ts, txn, decided):
    ts_dt = datetime.fromtimestamp(iso_to_epoch(ts), timezone.utc)
    deadline = time.time() + TIMEOUT_S
    while time.time() < deadline:
        row = session.execute(q, (card, ts_dt, txn)).one()
        if row is not None and row[0] is not None:
            return (time.time() - decided) * 1000
        time.sleep(0.02)
    return None


def on_message(msg, v, _):
    global count
    count += 1
    if count % every == 0:
        futures.append(pool.submit(wait_for_row, v["card_id"], v["ts"], v["txn_id"], iso_to_epoch(v["decided_at"])))


c = consumer(["decisions"])
poll_for(c, seconds, on_message)
c.close()

results = [f.result() for f in futures]
lat = [r for r in results if r is not None]
report("decision -> Cassandra (sink)", lat)
print(f"sampled 1 in {every}; not in txn_by_card after {TIMEOUT_S} s: {len(results) - len(lat)}")
