#!/usr/bin/env python3
"""
One CSV row -> one Kafka record:
  key       = cc_num (every topic is keyed by card_id, so they co-partition)
  value     = JSON of the event row, numbers typed
  timestamp = ts_epoch in ms (event time, used by Kafka Streams windows)

  REPLAY_SPEED = 1     -> real time
  REPLAY_SPEED = 3600  -> one real second per simulated hour
  REPLAY_SPEED = 0     -> no pacing, send as fast as possible
"""

import csv
import json
import logging
import signal
import sys
import time

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
        self.started_at = time.monotonic() # the start of the flow

        with open(path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)

            first_ts = None
            for row in reader:
                if self.stopping:
                    break
                event = to_event(row)

                event_ts = event["ts_epoch"]

                if first_ts is None:
                    first_ts = event_ts

                if self.speed > 0:
                    self.poll_until(self.started_at + (event_ts - first_ts) / self.speed)  # time since the FIRST event, scaled
                    if self.stopping:
                        break

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
