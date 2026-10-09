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
- Timestamps are shifted so the history ends now, and can be compressed
  (`--speed 3600` = one real second per simulated hour).

The data is not committed; set it up locally with the steps below.

## How to run

```bash
# 1. Get the generator
cd datasets
git clone https://github.com/namebrandon/Sparkov_Data_Generation.git

# 2. Download fraudTest.csv from Kaggle and save it as the raw input:
#    https://www.kaggle.com/datasets/kartik2112/fraud-detection
#    -> datasets/Sparkov_Data_Generation/data/simulate_data.csv

# 3. Build the stream (writes data/stream/)
cd Sparkov_Data_Generation
python3 ../prepare_stream.py --speed 3600

# 4. Replay it into Kafka
cd ../../platform
REPLAY_SPEED=1 docker compose up --build event-source
```

Use `--speed 3600` with `REPLAY_SPEED=1`, not 3600 for both: each compresses
time, so using both replays the 193-day dataset in about a second.
