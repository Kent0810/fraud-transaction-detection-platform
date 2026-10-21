#!/bin/sh
set -eu

: "${CONNECT_URL:?CONNECT_URL is not set}"
: "${CONFIG_DIR:?CONFIG_DIR is not set}"

for f in "$CONFIG_DIR"/*.json; do
  name=$(basename "$f" .json)
  echo "registering $name"
  curl -fsS -X PUT -H 'Content-Type: application/json' \
    --data @"$f" "$CONNECT_URL/connectors/$name/config"
  echo
done
