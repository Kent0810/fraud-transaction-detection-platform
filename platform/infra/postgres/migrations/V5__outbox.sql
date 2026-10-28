-- Written in the same transaction as the transfer, so an event exists exactly when the money moved.
-- Debezium reads it from the WAL and publishes to Kafka (wal_level=logical is already on).
CREATE TABLE IF NOT EXISTS outbox (
  event_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_id  text NOT NULL,
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_aggregate_idx ON outbox (aggregate_id);