"""Shared helpers for the evaluation scripts. Defaults match platform/docker-compose.yml."""
import json
import os
import statistics
import time
import uuid
from datetime import datetime, timezone


BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP", "localhost:29092")
CASSANDRA_HOST = os.environ.get("CASSANDRA_HOST", "localhost")
NOTIFIER_URL = os.environ.get("NOTIFIER_URL", "http://localhost:8081")


def consumer(topics, from_beginning=False):
    """A throwaway consumer group, so the evaluation never moves the services' offsets."""
    from confluent_kafka import Consumer  # only the Kafka scripts install it

    c = Consumer({
        "bootstrap.servers": BOOTSTRAP,
        "group.id": f"eval-{uuid.uuid4().hex[:8]}",
        "auto.offset.reset": "earliest" if from_beginning else "latest",
        "enable.auto.commit": False,
        "isolation.level": "read_committed",
    })
    c.subscribe(topics)
    return c


def poll_for(c, seconds, on_message):
    """Calls on_message(msg, value, received_at) for every record seen in the next `seconds`."""
    end = time.time() + seconds
    while time.time() < end:
        msg = c.poll(0.5)
        if msg is None or msg.error():
            continue
        on_message(msg, json.loads(msg.value()), time.time())


def iso_to_epoch(s):
    """ISO-8601 (Java Instant or Python isoformat) -> epoch seconds. Trims nanoseconds to micro."""
    s = s.replace("Z", "+00:00")
    if "." in s:
        head, rest = s.split(".", 1)
        digits = "".join(ch for ch in rest if ch.isdigit())
        tz = rest[len(digits):]
        s = f"{head}.{digits[:6].ljust(6, '0')}{tz}"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def report(name, values_ms, target_ms=None):
    """Prints count, p50, p95, p99, max in milliseconds, and whether the p95 meets the target."""
    if not values_ms:
        print(f"{name}: no samples")
        return
    v = sorted(values_ms)
    q = statistics.quantiles(v, n=100, method="inclusive") if len(v) > 1 else [v[0]] * 99
    line = (f"{name}: n={len(v)}  p50={q[49]:.0f} ms  p95={q[94]:.0f} ms  "
            f"p99={q[98]:.0f} ms  max={v[-1]:.0f} ms")
    if target_ms is not None:
        line += f"  target={target_ms:.0f} ms -> {'PASS' if q[94] <= target_ms else 'FAIL'} (p95)"
    print(line)
