# Card Fraud Platform

A streaming fraud-detection platform for a card-issuing bank: card payments and app transfers are checked by rules in Kafka Streams before any money moves. Analysts work the resulting alerts in an ops console, and cardholders see their history, budget and alerts in a mobile app.

## Tech stack

- **Streaming:** Apache Kafka, Kafka Streams (Java 21), Kafka Connect with Debezium (Postgres outbox) and the Cassandra sink
- **Storage:** PostgreSQL (ledger and system of record, Flyway migrations), Cassandra (read model for the apps)
- **Services:** NestJS + Prisma (cardholder backend, notifier), Python (event replay)
- **Apps:** React (ops console), Expo / React Native (cardholder app)
- **Runtime:** Docker Compose

## How to start

1. Prepare the data once (needs a Kaggle account), following [datasets/README.md](datasets/README.md):

   ```bash
   cd datasets
   git clone https://github.com/namebrandon/Sparkov_Data_Generation.git
   # download fraudTest.csv from https://www.kaggle.com/datasets/kartik2112/fraud-detection
   #   -> datasets/Sparkov_Data_Generation/data/simulate_data.csv
   python3 prepare_stream.py
   ```

2. Start everything:

   ```bash
   cd platform
   docker compose up -d --build
   ```

3. Open the apps. Every demo login uses the password `admin1234`.

   | App | URL | Sign in with |
   |---|---|---|
   | Ops console | http://localhost:3000 | `analyst@hcmmb.vn` or `agent@hcmmb.vn` |
   | Cardholder app (web) | http://localhost:19006 | any card number from `dim_card.csv` |
   | Kafka UI | http://localhost:8090 | — |

Stop with `docker compose down`; add `-v` to also delete all data.
