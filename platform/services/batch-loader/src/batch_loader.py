import csv
import json
import logging
import signal
import sys
import tempfile
import time
from datetime import datetime, timezone

import psycopg
from confluent_kafka import Consumer, KafkaException
from google.cloud import bigquery

from config import Config, ConfigError

log = logging.getLogger("batch-loader")

REVIEW_STATUS = {"CONFIRM_ALERT": "CONFIRMED", "CLEAR_ALERT": "CLEARED"}
INT_TYPES = {"INTEGER", "INT64"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ground_truth_row(r: dict, loaded_at: str) -> dict:
    return {"txn_id": r["txn_id"], "is_fraud": r["is_fraud"] == "1", "_loaded_at": loaded_at}


def dim_card_row(r: dict, loaded_at: str) -> dict:
    def num(kind, v):
        return kind(v) if v not in (None, "") else None

    return {
        "card_id": r["cc_num"],
        "city": r.get("city") or None,
        "state": r.get("state") or None,
        "zip": r.get("zip") or None,
        "lat": num(float, r.get("lat")),
        "long": num(float, r.get("long")),
        "city_pop": num(int, r.get("city_pop")),
        "_loaded_at": loaded_at,
    }


class Loader:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.bq = bigquery.Client(project=cfg.bq_project)
        self.dataset = f"{self.bq.project}.{cfg.raw_dataset}"
        self.consumer = Consumer({
            "bootstrap.servers": cfg.bootstrap,
            "group.id": cfg.group_id,
            "enable.auto.commit": False,
            "auto.offset.reset": "earliest",
            "isolation.level": "read_committed",
            "max.poll.interval.ms": (cfg.interval_seconds + 600) * 1000,
        })
        self.consumer.subscribe(list(cfg.topics))
        self.schemas: dict[str, list[bigquery.SchemaField]] = {}
        self.stopping = False

    def stop(self, signum, _frame):
        log.info("received signal %s, stopping after this batch", signum)
        self.stopping = True

    def table(self, name: str) -> str:
        return f"{self.dataset}.{name}"

    def fields(self, name: str) -> list[bigquery.SchemaField]:
        if name not in self.schemas:
            self.schemas[name] = self.bq.get_table(self.table(name)).schema
        return self.schemas[name]

    def run(self):
        log.info("loading into %s every %ss", self.dataset, self.cfg.interval_seconds)
        try:
            while not self.stopping:
                started = time.monotonic()
                self.load_side_files()
                self.load_reviews()
                self.load_topics()
                until = started + self.cfg.interval_seconds
                while not self.stopping and time.monotonic() < until:
                    time.sleep(1)
        finally:
            self.consumer.close()

    def load(self, table: str, rows, disposition: str) -> int:
        count = 0
        with tempfile.NamedTemporaryFile("w+b", suffix=".ndjson") as fh:
            for row in rows:
                fh.write(json.dumps(row, separators=(",", ":")).encode())
                fh.write(b"\n")
                count += 1
            if count == 0:
                return 0
            fh.seek(0)
            job = self.bq.load_table_from_file(
                fh,
                self.table(table),
                job_config=bigquery.LoadJobConfig(
                    source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
                    write_disposition=disposition,
                ),
            )
            job.result()
        log.info("loaded %d rows into %s", count, table)
        return count

    def load_side_files(self):
        loaded_at = now_iso()
        for table, path, convert in (
            ("ground_truth", self.cfg.ground_truth_file, ground_truth_row),
            ("dim_card", self.cfg.dim_card_file, dim_card_row),
        ):
            if self.bq.get_table(self.table(table)).num_rows > 0:
                continue
            try:
                with open(path, newline="", encoding="utf-8") as fh:
                    self.load(table, (convert(r, loaded_at) for r in csv.DictReader(fh)),
                              bigquery.WriteDisposition.WRITE_TRUNCATE)
            except FileNotFoundError:
                log.warning("%s is empty and %s does not exist, skipping", table, path)

    def load_reviews(self):
        table = self.table("alert_reviews")
        last = next(iter(self.bq.query(f"SELECT IFNULL(MAX(audit_id), 0) AS last FROM `{table}`").result())).last
        with psycopg.connect(self.cfg.postgres_dsn) as conn:
            found = conn.execute(
                """SELECT audit_id, card_id, staff_id, action, payload->>'alertId', payload->>'reason', at
                   FROM audit_log
                   WHERE action IN ('CONFIRM_ALERT', 'CLEAR_ALERT') AND audit_id > %s
                   ORDER BY audit_id""",
                (last,),
            ).fetchall()
        loaded_at = now_iso()
        rows = []
        for audit_id, card_id, staff_id, action, alert_id, reason, at in found:
            if not alert_id:
                log.error("skipping audit row %s: no alertId", audit_id)
                continue
            rows.append({
                "audit_id": audit_id,
                "card_id": card_id,
                "alert_id": alert_id,
                "txn_id": alert_id.split(":", 1)[0],
                "status": REVIEW_STATUS[action],
                "staff_id": staff_id,
                "reason": reason,
                "reviewed_at": at.isoformat(),
                "_loaded_at": loaded_at,
            })
        self.load("alert_reviews", rows, bigquery.WriteDisposition.WRITE_APPEND)

    def to_row(self, table: str, msg, loaded_at: str) -> dict | None:
        where = f"{msg.topic()}[{msg.partition()}]@{msg.offset()}"
        try:
            value = json.loads(msg.value()) if msg.value() is not None else None
        except ValueError:
            value = None
        if not isinstance(value, dict):
            log.error("skipping %s: not a JSON object", where)
            return None
        row = {}
        for f in self.fields(table):
            if f.name.startswith("_"):
                continue
            v = value.get(f.name)
            if f.mode == "REPEATED" and v is None:
                v = []
            if v is None and f.mode == "REQUIRED":
                log.error("skipping %s: no %s", where, f.name)
                return None
            if f.field_type in INT_TYPES and isinstance(v, float) and v.is_integer():
                v = int(v)
            row[f.name] = v
        row["_kafka_partition"] = msg.partition()
        row["_kafka_offset"] = msg.offset()
        row["_loaded_at"] = loaded_at
        return row

    def load_topics(self):
        deadline = time.monotonic() + 30
        while not self.consumer.assignment() and time.monotonic() < deadline:
            self.consumer.poll(1.0)

        loaded_at = now_iso()
        rows: dict[str, list[dict]] = {t: [] for t in self.cfg.topics.values()}
        consumed = 0
        while consumed < self.cfg.max_rows:
            msgs = self.consumer.consume(num_messages=1000, timeout=5.0)
            if not msgs:
                break
            for msg in msgs:
                if msg.error():
                    raise KafkaException(msg.error())
                consumed += 1
                table = self.cfg.topics[msg.topic()]
                row = self.to_row(table, msg, loaded_at)
                if row is not None:
                    rows[table].append(row)

        if consumed == 0:
            return
        for table, batch in rows.items():
            self.load(table, batch, bigquery.WriteDisposition.WRITE_APPEND)
        self.consumer.commit(asynchronous=False)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        cfg = Config.from_env()
    except ConfigError as e:
        log.error("%s", e)
        sys.exit(2)
    loader = Loader(cfg)
    signal.signal(signal.SIGTERM, loader.stop)
    signal.signal(signal.SIGINT, loader.stop)
    loader.run()


if __name__ == "__main__":
    main()
