# Card Fraud Platform

A streaming fraud-detection platform for card transactions. Simulated
transactions are replayed into Kafka as if they were happening live, scored by
rules in Kafka Streams, and the results are served to analysts and cardholders
and loaded into BigQuery for reporting.

```
                         ┌─────────────── hot path ───────────────┐
datasets ──> event-source ──> Kafka: transactions ──> fraud-detector ──> decisions / alerts / cases
                                         ▲                                   │
                                         │ control                           ├──> Cassandra ──> ops-console, cardholder-app
              ops-console ──> Postgres ──┘ (outbox via Debezium)             └──> notifier ──> cardholder-app
                                                                             
              all topics ──> batch-loader ──> BigQuery ──> risk dashboards (cold path)
```

## Status

| Component | State |
|---|---|
| `datasets/prepare_stream.py` | ✅ working |
| `event-source` (CSV -> Kafka `transactions`) | ✅ working |
| Kafka + topic init (`kafka`, `kafka-init`) | ✅ working |
| `fraud-detector` (Kafka Streams, Java) | 🚧 reads `transactions` and logs progress; no rules or output topics yet |
| notifier, ops-console, cardholder-app, batch-loader | 🚧 not built yet (commented out in compose) |

## Prerequisites

- Docker with Compose v2
- Python 3.12+ (only for `prepare_stream.py`, stdlib only)
- A Kaggle account to download the source data

## How to run

### 1. Prepare the data (once)

The data is not in git. Follow [datasets/README.md](datasets/README.md), in short:

```bash
cd datasets
git clone https://github.com/namebrandon/Sparkov_Data_Generation.git
# download fraudTest.csv from https://www.kaggle.com/datasets/kartik2112/fraud-detection
#   -> datasets/Sparkov_Data_Generation/data/simulate_data.csv
python3 prepare_stream.py
```

### 2. Start Kafka and the replay

```bash
cd platform
docker compose up -d --build event-source
```

This starts `kafka`, runs `kafka-init` (creates the topics), then starts
`event-source`, which replays `events.csv` into the `transactions` topic. Event
times are restamped to "now", and with the default `REPLAY_SPEED=3600` the
replay takes about 1.3 hours.

### 3. Check it is working

```bash
# progress logs ("sent N records ...")
docker compose logs -f event-source

# read a few records
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic transactions --from-beginning \
  --max-messages 5 --property print.key=true --property print.timestamp=true
```

From the host, Kafka is reachable at `localhost:29092`.

To also run the fraud detector, which reads `transactions` from the beginning
and logs one line per 1000 records:

```bash
docker compose up -d --build fraud-detector
docker compose logs -f fraud-detector
```

### 4. Stop / reset

```bash
docker compose stop event-source   # stops cleanly, flushes pending records
docker compose down                # stop and remove containers, keep data
docker compose down -v             # also delete volumes (all Kafka data)
```

Restarting `event-source` replays the file from the beginning, so records are
duplicated unless you reset the `transactions` topic first.

## Configuration

Set as environment variables before `docker compose up`:

| Variable | Default | Meaning |
|---|---|---|
| `REPLAY_SPEED` | `3600` | Replay speed: `3600` = one real second per simulated hour, `1` = real time |
| `KAFKA_PARTITIONS` | `12` | Partitions per topic (all card-keyed topics share it so they co-partition) |
| `KAFKA_VERSION` | `4.3.1` | Kafka image tag |

Topic names and the bootstrap address are set in `platform/docker-compose.yml`
(`x-kafka-env`).

## Repository layout

```
datasets/
  prepare_stream.py            raw CSV -> events / ground truth / card profiles
  README.md                    data setup
platform/
  docker-compose.yml           every service of the platform
  scripts/kafka-init.sh        creates the Kafka topics
  services/
    event-source/              Python, replays events.csv into Kafka
    fraud-detector/            Java (Maven), Kafka Streams app; reads transactions for now
    notifier/                  (planned) alerts -> push notifications
    card-holder-app/           (planned) backend + mobile
```
