# /// script
# requires-python = ">=3.12"
# dependencies = ["confluent-kafka==2.15.1"]
# ///
"""NFR10: every transaction has exactly one decision.

A transaction record is matched to its decision by (txn_id, record timestamp): Kafka Streams
keeps the input timestamp, and a replay restarted from the beginning re-sends the same txn_id
with a new timestamp, so txn_id alone would count those as duplicates.

Run after a replay; for the fault test, restart the fraud-detector in the middle of it
(docker compose restart fraud-detector). Reads both topics from the start (7-day retention).
  uv run exactly_once.py
"""
import json
import time
from collections import Counter

from confluent_kafka import Consumer, TopicPartition
from confluent_kafka.admin import AdminClient

from common import BOOTSTRAP


def read_all(topic):
    """(txn_id, record timestamp) of every committed record on a topic, up to the current end."""
    admin = AdminClient({"bootstrap.servers": BOOTSTRAP})
    parts = admin.list_topics(topic).topics[topic].partitions
    c = Consumer({"bootstrap.servers": BOOTSTRAP, "group.id": "eval-eo",
                  "enable.auto.commit": False, "isolation.level": "read_committed"})
    ends = {p: c.get_watermark_offsets(TopicPartition(topic, p))[1] for p in parts}
    assigned = [TopicPartition(topic, p, 0) for p in parts]
    c.assign(assigned)
    ids = []
    checked = time.time()
    while True:
        msg = c.poll(1.0)
        # Records produced after the start (the replay may still be running) are left out.
        if msg is not None and not msg.error() and msg.offset() < ends[msg.partition()]:
            ids.append((json.loads(msg.value())["txn_id"], msg.timestamp()[1]))
        # Check the end even while records keep arriving. Transaction markers take offsets too,
        # so compare positions, not the last record's offset.
        if msg is None or time.time() - checked > 1:
            checked = time.time()
            if all(tp.offset >= ends[tp.partition] for tp in c.position(assigned)):
                break
    c.close()
    return ids


tx = Counter(read_all("transactions"))
dec = Counter(read_all("decisions"))  # read second, so every transaction above has had time to be decided
missing = [k for k in tx if dec[k] < tx[k]]
dupes = [k for k in tx if dec[k] > tx[k]]
print(f"transaction records: {sum(tx.values())}  matching decisions: {sum(dec[k] for k in tx)}")
print(f"missing decisions: {len(missing)}  duplicated decisions: {len(dupes)}")
print("NFR10", "PASS" if not missing and not dupes else "FAIL")
