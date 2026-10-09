# Card Fraud Platform

A streaming fraud-detection platform for card transactions. Simulated
transactions are replayed into Kafka as if they were happening live, scored by
rules in Kafka Streams, and the results are served to analysts and cardholders
and loaded into BigQuery for reporting.

```
                         ┌─────────────── hot path ───────────────┐
datasets ──> event-source ──> Kafka: transactions ──> stream-processor ──> decisions / alerts / cases
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
| stream-processor, notifier, ops-console, cardholder-app, batch-loader | 🚧 not built yet (defined in compose only) |

Because the other services have no code yet, start **only** `event-source`, not
the whole compose file.

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
python3 prepare_stream.py --speed 3600
```

### 2. Start Kafka and the replay

```bash
cd platform
docker compose up -d --build event-source
```

This starts `kafka`, runs `kafka-init` (creates the topics and seeds
`risk_categories`), then starts `event-source`, which replays `events.csv` into
the `transactions` topic. With the default `REPLAY_SPEED=1` the replay takes
about 1.3 hours.

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
| `REPLAY_SPEED` | `1` | Time compression of the replay. Keep `1` when `prepare_stream.py --speed 3600` was used, or the timeline is compressed twice |
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
  infra/kafka/                 seed data for kafka-init (risk_categories.txt)
  services/
    event-source/              Python, replays events.csv into Kafka
    stream-processor/          (planned) Kafka Streams rules app, Java
    notifier/                  (planned) alerts -> push notifications
    card-holder-app/           (planned) backend + mobile
```
