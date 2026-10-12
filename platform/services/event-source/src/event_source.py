#!/usr/bin/env python3
"""
One CSV row -> one Kafka record:
  key       = cc_num (every topic is keyed by card_id, so they co-partition)
  value     = JSON of the event row, numbers typed
  timestamp = event time in ms (used by Kafka Streams windows)

Event time is restamped at replay: the first event is "now", and the gaps
between events are divided by REPLAY_SPEED, so ts / ts_epoch / timestamp all
match the moment the record is sent.

  REPLAY_SPEED = 1     -> real time (193-day dataset takes 193 days)
  REPLAY_SPEED = 3600  -> one real second per simulated hour (~1.3 h)
"""

import csv
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone

from confluent_kafka import KafkaException, Producer

from config import Config, ConfigError
from constants.float_fields import FLOAT_FIELDS

log = logging.getLogger("event-source")

def to_event(row):
    event = dict(row)
    for field in FLOAT_FIELDS:
        event[field] = float(event[field])
    return event


class Replayer:
    def __init__(self, producer, topic, speed, log_every):
        self.producer = producer
        self.topic = topic
        self.speed = speed
        self.log_every = log_every
        self.stopping = False
        self.sent = 0
        self.failed = 0
        self.started_at = 0

    def stop(self, signum, _frame):
        log.info("received signal %s, stopping", signum)
        self.stopping = True

    def on_delivery(self, err, msg):
        if err is not None:
            self.failed += 1
            log.error("delivery failed on key=%s: %s", msg.key(), err)

    def produce(self, key, value, timestamp_ms):
        while True:
            try:
                self.producer.produce(
                    self.topic,
                    key=key,
                    value=value,
                    timestamp=timestamp_ms,
                    on_delivery=self.on_delivery,
                )
                return
            except BufferError:
                self.producer.poll(0.5)

    def poll_until(self, deadline):
        # Serve delivery reports until the deadline, or until we are stopping.
        while not self.stopping:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            # Wait at most 0.5s per round, so we notice self.stopping quickly.
            self.producer.poll(min(remaining, 0.5))

        self.producer.poll(0)

    def run(self, path):
        self.started_at = time.monotonic() # the start of the flow, for pacing
        replay_start = time.time()         # the same moment on the wall clock, for event time

        with open(path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)

            first_ts = None
            for row in reader:
                if self.stopping:
                    break
                event = to_event(row)

                source_ts = event["ts_epoch"]

                if first_ts is None:
                    first_ts = source_ts

                offset = (source_ts - first_ts) / self.speed  # time since the FIRST event, scaled

                self.poll_until(self.started_at + offset)
                if self.stopping:
                    break

                # Restamp: the replay looks live, starting now, compressed by REPLAY_SPEED.
                event_ts = replay_start + offset
                event["ts_epoch"] = round(event_ts, 3)
                event["ts"] = datetime.fromtimestamp(event_ts, timezone.utc).isoformat(timespec="milliseconds")

                self.produce(
                    key=event["cc_num"].encode(),
                    value=json.dumps(event, separators=(",", ":")).encode(),
                    timestamp_ms=int(event_ts * 1000),
                )

                self.sent += 1 

                if self.sent % self.log_every == 0:
                    log.info("sent %d records (event time %s)", self.sent, event["ts"])


def main():
    # Get config from docker compose
    cfg = Config.from_env()

    # Init Kafka Producer that sends records to Kafka
    producer = Producer({
        "bootstrap.servers": cfg.bootstrap,
        "client.id": "event-source",
        "enable.idempotence": True,   # acks=all, no duplicates on producer retry
        "compression.type": "lz4",
        "linger.ms": 20,
    })

    replayer = Replayer(producer, cfg.topic, cfg.speed, cfg.log_every)

    signal.signal(signal.SIGTERM, replayer.stop)
    signal.signal(signal.SIGINT, replayer.stop)

    log.info("start replaying %s -> %s (speed %g, bootstrap %s)", cfg.path, cfg.topic, cfg.speed, cfg.bootstrap)
    try:
        replayer.run(cfg.path)
    finally:
        remaining = producer.flush(30)
        if remaining:
            log.error("%d records still undelivered after flush", remaining)
            replayer.failed += remaining

    log.info("done: sent %d, failed items %d", replayer.sent, replayer.failed)
    if replayer.failed:
        sys.exit(1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    try:
        main()
    except ConfigError as exc:
        log.error("config error: %s", exc)
        sys.exit(1)
    except KafkaException as exc:
        log.error("kafka error: %s", exc)
        sys.exit(1)
