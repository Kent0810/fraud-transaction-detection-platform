import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

# Static-per-card columns: dropped from the event, written to dim_card.csv.
CARD_COLS = [
    "first", "last", "gender", "street", "city", "state", "zip",
    "lat", "long", "city_pop", "job", "dob",
]
DIM_CARD_HEADER = ["cc_num"] + CARD_COLS

# Shared with app transfers (channel TRANSFER).
EVENT_HEADER = [
    "txn_id", "ts", "ts_epoch", "cc_num", "channel", "merchant", "counterparty_account",
    "category", "amt", "currency", "merch_lat", "merch_long",
]
GROUND_TRUTH_HEADER = ["txn_id", "is_fraud"]

MERCHANT_PREFIX = "fraud_"

CURRENCY = "VND"
VND_PER_USD = 25_000

# Defaults resolve next to this script, so it runs from any working directory.
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "Sparkov_Data_Generation", "data")


def iso(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="milliseconds")


def scan_source(path):
    """Pass 1: max(unix_time), row count, and one profile row per card."""
    max_unix = None
    min_unix = None
    rows = 0
    cards = {}
    conflicts = 0
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in ["cc_num", "unix_time", "trans_num", "is_fraud"] + CARD_COLS
                   if c not in reader.fieldnames]
        if missing:
            sys.exit(f"error: {path} is missing required columns: {', '.join(missing)}")
        for row in reader:
            rows += 1
            unix_time = int(row["unix_time"])
            if max_unix is None or unix_time > max_unix:
                max_unix = unix_time
            if min_unix is None or unix_time < min_unix:
                min_unix = unix_time
            cc_num = row["cc_num"]
            profile = tuple(row[c] for c in CARD_COLS)
            known = cards.get(cc_num)
            if known is None:
                cards[cc_num] = profile
            elif known != profile:
                conflicts += 1
    if rows == 0:
        sys.exit(f"error: {path} has no data rows")
    return {
        "rows": rows,
        "min_unix": min_unix,
        "max_unix": max_unix,
        "cards": cards,
        "conflicts": conflicts,
    }


def write_dim_card(path, cards):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(DIM_CARD_HEADER)
        for cc_num in sorted(cards):
            writer.writerow([cc_num] + list(cards[cc_num]))


def write_stream(src, events_path, truth_path):
    """Pass 2: events (no label, no profile) + ground truth, in source order."""
    written = 0
    frauds = 0
    first_ts = None
    last_ts = None
    with open(src, newline="", encoding="utf-8") as fh, \
            open(events_path, "w", newline="", encoding="utf-8") as ev_fh, \
            open(truth_path, "w", newline="", encoding="utf-8") as gt_fh:
        reader = csv.DictReader(fh)
        events = csv.writer(ev_fh)
        truth = csv.writer(gt_fh)
        events.writerow(EVENT_HEADER)
        truth.writerow(GROUND_TRUTH_HEADER)
        for row in reader:
            ts_epoch = int(row["unix_time"])
            txn_id = row["trans_num"]
            merchant = row["merchant"]
            if merchant.startswith(MERCHANT_PREFIX):
                merchant = merchant[len(MERCHANT_PREFIX):]
            events.writerow([
                txn_id,
                iso(ts_epoch),
                f"{ts_epoch:.3f}",
                row["cc_num"],
                "CARD",
                merchant,
                "",
                row["category"],
                round(float(row["amt"]) * VND_PER_USD),
                CURRENCY,
                row["merch_lat"],
                row["merch_long"],
            ])
            is_fraud = row["is_fraud"]
            truth.writerow([txn_id, is_fraud])
            written += 1
            frauds += int(is_fraud)
            if first_ts is None:
                first_ts = ts_epoch
            last_ts = ts_epoch
    return written, frauds, first_ts, last_ts


def main():
    parser = argparse.ArgumentParser(
        description="Reshape simulate_data.csv into events + ground truth + dim_card.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "examples:\n"
            "  python prepare_stream.py\n"
            "  python prepare_stream.py -i other.csv -o out/\n"
            "\n"
            "replay speed is set by REPLAY_SPEED in platform/docker-compose.yml\n"
        ),
    )
    parser.add_argument("-i", "--input", default=os.path.join(DATA_DIR, "simulate_data.csv"),
                        help="source CSV (default: %(default)s)")
    parser.add_argument("-o", "--outdir", default=os.path.join(DATA_DIR, "stream"),
                        help="output folder (default: %(default)s)")
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    events_path = os.path.join(args.outdir, "events.csv")
    truth_path = os.path.join(args.outdir, "ground_truth.csv")
    dim_path = os.path.join(args.outdir, "dim_card.csv")
    manifest_path = os.path.join(args.outdir, "manifest.json")

    print(f"scanning {args.input} ...")
    scan = scan_source(args.input)
    if scan["conflicts"]:
        print(f"warning: {scan['conflicts']} rows carry a profile that differs from the "
              f"first one seen for that card; keeping the first.", file=sys.stderr)

    write_dim_card(dim_path, scan["cards"])
    print(f"wrote {dim_path} ({len(scan['cards'])} cards)")

    written, frauds, first_ts, last_ts = write_stream(args.input, events_path, truth_path)
    print(f"wrote {events_path} ({written} events)")
    print(f"wrote {truth_path} ({frauds} fraudulent)")

    manifest = {
        "source": os.path.abspath(args.input),
        "generated_at": iso(datetime.now(timezone.utc).timestamp()),
        "rows": written,
        "cards": len(scan["cards"]),
        "fraud_rows": frauds,
        "currency": CURRENCY,
        "vnd_per_usd": VND_PER_USD,
        "source_unix_min": scan["min_unix"],
        "source_unix_max": scan["max_unix"],
        "stream_start": iso(first_ts),
        "stream_end": iso(last_ts),
        "stream_span_seconds": last_ts - first_ts,
    }
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    print(f"wrote {manifest_path}")
    print(f"\nevents span {manifest['stream_start']} -> {manifest['stream_end']} "
          f"({manifest['stream_span_seconds'] / 86400:,.1f} days); "
          f"replay speed: REPLAY_SPEED in docker-compose.yml")


if __name__ == "__main__":
    main()
