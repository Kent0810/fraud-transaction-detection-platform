#!/usr/bin/env bash
# Creates every app topic. Idempotent: safe to re-run.
#
# Env (all required, set in docker-compose.yml; no defaults here):
#   KAFKA_BOOTSTRAP_SERVERS  Kafka address
#   PARTITIONS               partitions per card topic (identical so they co-partition)
set -euo pipefail

BIN=/opt/kafka/bin
: "${KAFKA_BOOTSTRAP_SERVERS:?KAFKA_BOOTSTRAP_SERVERS is not set}"
: "${PARTITIONS:?PARTITIONS is not set}"

create() {
  "$BIN/kafka-topics.sh" --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" --create --if-not-exists \
    --topic "$1" --partitions "$2" --replication-factor 1 "${@:3}"
}

create transactions  "$PARTITIONS" --config retention.ms=604800000
create decisions     "$PARTITIONS" --config retention.ms=604800000
create alerts        "$PARTITIONS" --config retention.ms=604800000
create control       "$PARTITIONS" --config retention.ms=-1
create cases         "$PARTITIONS" --config cleanup.policy=compact
create settlements   "$PARTITIONS" --config retention.ms=604800000

"$BIN/kafka-topics.sh" --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" --list
