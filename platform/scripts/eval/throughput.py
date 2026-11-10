# /// script
# requires-python = ">=3.12"
# dependencies = ["confluent-kafka==2.15.1"]
# ///
"""NFR11: events per second in and out of the detector, and its consumer lag.

Run while the replay runs, at REPLAY_SPEED=3600 and then higher:
  uv run throughput.py [seconds] [interval]
The detector keeps up if the lag does not grow by more than one second of input over the run
(a lag of a few records is noise). `out/s` counts offsets on `decisions`, which include the
commit markers of exactly-once transactions, so it is higher than `in/s`.
"""
import sys
import time

from confluent_kafka import Consumer, TopicPartition
from confluent_kafka.admin import AdminClient

from common import BOOTSTRAP

seconds = int(sys.argv[1]) if len(sys.argv) > 1 else 300
every = int(sys.argv[2]) if len(sys.argv) > 2 else 10
GROUP = "fraud-rules"  # APPLICATION_ID of the fraud-detector

admin = AdminClient({"bootstrap.servers": BOOTSTRAP})
probe = Consumer({"bootstrap.servers": BOOTSTRAP, "group.id": GROUP, "enable.auto.commit": False})


def partitions(topic):
    return [TopicPartition(topic, p) for p in admin.list_topics(topic).topics[topic].partitions]


tx_parts, dec_parts = partitions("transactions"), partitions("decisions")


def end(parts):
    return sum(probe.get_watermark_offsets(tp, timeout=5)[1] for tp in parts)


def lag():
    committed = probe.committed(tx_parts, timeout=10)
    return sum(probe.get_watermark_offsets(tp, timeout=5)[1] - max(tp.offset, 0) for tp in committed)


print(f"{'time':>6} {'in/s':>8} {'out/s':>8} {'lag':>8}")
prev_in, prev_out, lags = end(tx_parts), end(dec_parts), []
first_in = prev_in
start = time.time()
while time.time() - start < seconds:
    time.sleep(every)
    cur_in, cur_out, cur_lag = end(tx_parts), end(dec_parts), lag()
    lags.append(cur_lag)
    print(f"{time.time() - start:6.0f} {(cur_in - prev_in) / every:8.1f} "
          f"{(cur_out - prev_out) / every:8.1f} {cur_lag:8d}")
    prev_in, prev_out = cur_in, cur_out

third = max(len(lags) // 3, 1)
growth = sum(lags[-third:]) / third - sum(lags[:third]) / third if lags else 0
rate = (end(tx_parts) - first_in) / (time.time() - start)
if rate == 0:
    sys.exit("no transactions came in: start the replay first")
verdict = "keeps up" if growth <= rate else "falling behind"
print(f"avg in {rate:.0f}/s, max lag {max(lags, default=0)} ({max(lags, default=0) / rate * 1000:.0f} ms of input), "
      f"lag growth {growth:+.0f} -> {verdict}")
probe.close()
