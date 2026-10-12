# Datasets

## Purpose

The platform needs a live stream of card transactions to detect fraud on.
Instead of real card data, we replay a simulated dataset (generated with
[Sparkov](https://github.com/namebrandon/Sparkov_Data_Generation)) into Kafka
as if the transactions were happening now.

`prepare_stream.py` turns the raw CSV into that replayable stream:

- **Events** (`events.csv`): what a card network would actually see, one row per
  transaction. The fraud label and the cardholder profile are removed.
- **Ground truth** (`ground_truth.csv`): the fraud label per transaction, kept
  aside to measure how well the rules catch fraud.
- **Card profiles** (`dim_card.csv`): static cardholder data, one row per card.
- Timestamps stay as in the source. event-source restamps them at replay time,
  so the stream looks live; the speed is `REPLAY_SPEED` in
  `platform/docker-compose.yml`.

The data is not committed; set it up locally with the steps below.

## Input / output

**Input:** `Sparkov_Data_Generation/data/simulate_data.csv`

**Output** (`Sparkov_Data_Generation/data/stream/`):

| File | Fields | Rows |
|---|---|---|
| `events.csv` | `txn_id`, `ts`, `ts_epoch`, `cc_num`, `merchant`, `category`, `amt`, `merch_lat`, `merch_long` | one per transaction |
| `ground_truth.csv` | `txn_id`, `is_fraud` | one per transaction |
| `dim_card.csv` | `cc_num`, `first`, `last`, `gender`, `street`, `city`, `state`, `zip`, `lat`, `long`, `city_pop`, `job`, `dob` | one per card |
| `manifest.json` | row counts and time span | — |

**Dropped fields:** the unnamed index column, `trans_date_trans_time`

## How to run

```bash
# 1. Get the generator
cd datasets
git clone https://github.com/namebrandon/Sparkov_Data_Generation.git

# 2. Download fraudTest.csv from Kaggle and save it as the raw input:
#    https://www.kaggle.com/datasets/kartik2112/fraud-detection
#    -> datasets/Sparkov_Data_Generation/data/simulate_data.csv

# 3. Build the stream (writes Sparkov_Data_Generation/data/stream/; works from any folder)
python3 prepare_stream.py

# 4. Replay it into Kafka
cd ../platform
docker compose up --build event-source
```

Replay speed is `REPLAY_SPEED` in `platform/docker-compose.yml` (default `3600`:
one real second per simulated hour, the 193-day dataset in about 1.3 hours).
`events.csv` does not depend on it, so you only rebuild it when the source changes.
