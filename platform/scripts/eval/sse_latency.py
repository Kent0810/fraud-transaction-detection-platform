# /// script
# requires-python = ">=3.12"
# dependencies = ["confluent-kafka==2.15.1", "httpx==0.28.1"]
# ///
"""NFR2 / NFR8: time from the decision (or settlement) to the event arriving over SSE.

Measured from the record's own decided_at / settled_at, not its Kafka timestamp: a replayed
transaction's timestamp is the replay's planned time, not when it was decided.

  staff console  (NFR2, target 1 s):  TOKEN=<staff token> uv run sse_latency.py ops [seconds]
  cardholder app (NFR8, target 3 s):  TOKEN=<card token>  uv run sse_latency.py card [seconds]

Take the token from the browser's local storage after signing in. In `card` mode, make a
transfer or payment from that card while the script runs.
"""
import json
import os
import sys
import threading
import time

import httpx

from common import NOTIFIER_URL, consumer, iso_to_epoch, report

mode = sys.argv[1] if len(sys.argv) > 1 else "ops"
seconds = int(sys.argv[2]) if len(sys.argv) > 2 else 120
path, topics, target = {
    "ops": ("/ops/alerts/live", ["decisions"], 1000),
    "card": ("/me/notifications/live", ["decisions", "settlements", "credits"], 3000),
}[mode]

record_ts = {}   # txn_id -> latest decided_at / settled_at (s) among the source topics
received = {}    # txn_id -> when the SSE event arrived (s)
stop = time.time() + seconds


def follow_kafka():
    c = consumer(topics)
    while time.time() < stop:
        msg = c.poll(0.5)
        if msg is None or msg.error():
            continue
        v = json.loads(msg.value())
        at = v.get("settled_at") or v.get("decided_at")
        if at:
            record_ts[v["txn_id"]] = iso_to_epoch(at)
    c.close()


threading.Thread(target=follow_kafka, daemon=True).start()
time.sleep(2)  # let the consumer join before the first event

headers = {"Authorization": f"Bearer {os.environ['TOKEN']}"}
with httpx.stream("GET", NOTIFIER_URL + path, headers=headers, timeout=None) as r:
    r.raise_for_status()
    for line in r.iter_lines():
        if time.time() > stop:
            break
        if line.startswith("data:") and line[5:].strip():
            data = json.loads(line[5:])
            received[data["txnId"]] = time.time()

time.sleep(1)
lat = [(received[t] - record_ts[t]) * 1000 for t in received if t in record_ts]
report(f"{'NFR2' if mode == 'ops' else 'NFR8'} decision -> SSE ({mode})", lat, target_ms=target)
