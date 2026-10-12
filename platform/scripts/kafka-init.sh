#!/usr/bin/env bash
# Creates every app topic and seeds risk_categories. Idempotent: safe to re-run.
#
# Env:
#   BOOTSTRAP   Kafka address              (default kafka:9092)
#   PARTITIONS  partitions per card topic  (default 12; identical so they co-partition)
#   SEED_DIR    folder with risk_categories.txt (default /seed)
set -euo pipefail

BIN=/opt/kafka/bin
BOOTSTRAP=${BOOTSTRAP:-kafka:9092}
PARTITIONS=${PARTITIONS:-12}
SEED_DIR=${SEED_DIR:-/seed}

create() {
  "$BIN/kafka-topics.sh" --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
    --topic "$1" --partitions "$2" --replication-factor 1 "${@:3}"
}

create transactions "$PARTITIONS" --config retention.ms=604800000
create decisions    "$PARTITIONS" --config retention.ms=604800000
create alerts       "$PARTITIONS" --config retention.ms=604800000
create cases        "$PARTITIONS" --config cleanup.policy=compact
create control      "$PARTITIONS" --config retention.ms=-1

# small reference data read as a GlobalKTable (R5); 1 partition is enough
create risk_categories 1 --config cleanup.policy=compact

"$BIN/kafka-console-producer.sh" --bootstrap-server "$BOOTSTRAP" --topic risk_categories \
  --property parse.key=true --property key.separator=: < "$SEED_DIR/risk_categories.txt"

"$BIN/kafka-topics.sh" --bootstrap-server "$BOOTSTRAP" --list
