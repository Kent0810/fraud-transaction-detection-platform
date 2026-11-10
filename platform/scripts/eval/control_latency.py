# /// script
# requires-python = ">=3.12"
# dependencies = ["confluent-kafka==2.15.1"]
# ///
"""NFR3: time from a control change being committed (freeze, budget, recipient rule)
to the event reaching the `control` topic through the outbox and Debezium (target 1 s).

Run it, then freeze/unfreeze a card or block a recipient a few dozen times in the app
or console:  uv run control_latency.py [seconds]
The detector applies the event as soon as it reads it, so this is the control loop's delay
before the card's next transaction; add the NFR6 latency for the full picture.
"""
import sys

from common import consumer, iso_to_epoch, poll_for, report

seconds = int(sys.argv[1]) if len(sys.argv) > 1 else 300
lat = []


def on_message(msg, v, received_at):
    # `ts` is set by the backend inside the transaction that wrote the outbox row.
    lat.append((received_at - iso_to_epoch(v["ts"])) * 1000)
    print(f"  {v.get('action')} on card {msg.key().decode()}: {lat[-1]:.0f} ms")


c = consumer(["control"])
poll_for(c, seconds, on_message)
c.close()
report("NFR3 commit -> control topic", lat, target_ms=1000)
