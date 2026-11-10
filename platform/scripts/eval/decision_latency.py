# /// script
# requires-python = ">=3.12"
# dependencies = ["confluent-kafka==2.15.1"]
# ///
"""NFR6: time from a transaction entering Kafka to its decision (target 500 ms).

Both ends are timed by this script's own clock, when each record reaches it: the
transactions record's timestamp is the replay's planned time, not when it was sent, so it
can sit tens of ms off the detector's clock. Fetch delay is paid on both sides and cancels.
Start the replay, then run:  uv run decision_latency.py [seconds]
"""
import sys

from common import consumer, poll_for, report

seconds = int(sys.argv[1]) if len(sys.argv) > 1 else 120
entered, decided = {}, {}


def on_message(msg, v, received_at):
    key = (v["txn_id"], msg.timestamp()[1])  # a replay can resend a txn_id; the timestamp tells them apart
    if msg.topic() == "transactions":
        entered.setdefault(key, received_at)
    else:
        decided.setdefault(key, received_at)


c = consumer(["transactions", "decisions"])
poll_for(c, seconds, on_message)
c.close()

lat = [(decided[k] - entered[k]) * 1000 for k in decided if k in entered]
report("NFR6 transaction -> decision", lat, target_ms=500)
