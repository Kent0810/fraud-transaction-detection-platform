"""
Per-transaction features, computed only from the card's EARLIER transactions, so the stream
(fraud-detector state stores) can compute exactly the same values at decision time.
Change a definition here and in the Java scoring code together, or the model sees different
inputs in production than in training (training/serving skew).
"""

import numpy as np
import pandas as pd

MISSING = -1.0  # no history yet (first transaction of a card). Plain number so ONNX/Java stay simple.

NUMERIC_FEATURES = [
    "amt",                  # transaction amount (USD)
    "hour",                 # hour of day, 0-23 (UTC)
    "day_of_week",          # 0 = Monday
    "is_online",            # category ends with _net
    "prior_txn_count",      # card's transactions before this one
    "secs_since_prev",      # seconds since the card's previous transaction
    "amt_mean_30d",         # mean amount of the card's transactions in the previous 30 days
    "amt_ratio_30d",        # amt / amt_mean_30d
    "txn_count_1h",         # card's transactions in the previous hour
    "txn_count_24h",        # card's transactions in the previous 24 hours
    "km_from_prev",         # distance from the previous transaction's merchant location
    "speed_kmh_from_prev",  # km_from_prev / hours since previous transaction
]


def _haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * np.arcsin(np.sqrt(a))


def _per_card(g: pd.DataFrame) -> pd.DataFrame:
    g = g.sort_values("ts_epoch")
    s = pd.Series(g["amt"].to_numpy(), index=g["dt"].to_numpy())
    out = pd.DataFrame(index=g.index)

    out["prior_txn_count"] = np.arange(len(g), dtype=float)
    out["secs_since_prev"] = g["ts_epoch"].diff().fillna(MISSING).to_numpy()

    # closed="left": the window ends just BEFORE this transaction, so it never sees itself.
    mean_30d = s.rolling("30D", closed="left").mean().to_numpy()
    out["amt_mean_30d"] = np.where(np.isnan(mean_30d), MISSING, mean_30d)
    out["amt_ratio_30d"] = np.where(np.isnan(mean_30d) | (mean_30d == 0), MISSING, g["amt"].to_numpy() / mean_30d)
    out["txn_count_1h"] = np.nan_to_num(s.rolling("1h", closed="left").count().to_numpy(), nan=0.0)
    out["txn_count_24h"] = np.nan_to_num(s.rolling("24h", closed="left").count().to_numpy(), nan=0.0)

    km = _haversine_km(g["merch_lat"].shift(), g["merch_long"].shift(), g["merch_lat"], g["merch_long"]).to_numpy()
    hours = g["ts_epoch"].diff().to_numpy() / 3600.0
    out["km_from_prev"] = np.where(np.isnan(km), MISSING, km)
    with np.errstate(divide="ignore", invalid="ignore"):
        speed = km / hours
    out["speed_kmh_from_prev"] = np.where(np.isnan(speed) | np.isinf(speed), MISSING, speed)
    return out


def build(events: pd.DataFrame, categories: list[str]) -> pd.DataFrame:
    """events: the events.csv columns. Returns one row per event: features in model order."""
    df = events.copy()
    df["dt"] = pd.to_datetime(df["ts_epoch"], unit="s", utc=True)

    feats = pd.DataFrame(index=df.index)
    feats["amt"] = df["amt"]
    feats["hour"] = df["dt"].dt.hour.astype(float)
    feats["day_of_week"] = df["dt"].dt.dayofweek.astype(float)
    feats["is_online"] = df["category"].str.endswith("_net").astype(float)

    history = pd.concat([_per_card(g) for _, g in df.groupby("cc_num", sort=False)])
    feats = feats.join(history)

    # One-hot categories (fixed list, saved in the spec so Java builds the same columns).
    for cat in categories:
        feats[f"cat_{cat}"] = (df["category"] == cat).astype(float)

    return feats[feature_names(categories)].astype(np.float32)


def feature_names(categories: list[str]) -> list[str]:
    return NUMERIC_FEATURES + [f"cat_{c}" for c in categories]
