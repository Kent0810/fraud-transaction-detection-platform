-- Written in the same transaction as the change it announces, so an event exists exactly when the change happened.
-- Debezium reads it from the WAL and publishes to Kafka (wal_level=logical is already on):
-- aggregate_type is the topic, aggregate_id the message key, payload the message value (infra/connect/connectors/sources/outbox-source.json).
CREATE TABLE IF NOT EXISTS outbox (
  event_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type  text NOT NULL,
  aggregate_id    text NOT NULL,
  type            text NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_aggregate_idx ON outbox (aggregate_id);

-- Debezium streams only this table. Created here because only the table's owner can publish it.
DROP PUBLICATION IF EXISTS outbox_publication;
CREATE PUBLICATION outbox_publication FOR TABLE outbox;
