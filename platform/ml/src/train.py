"""
Trains the fraud model and exports it for fraud-detector.

  uv run python src/train.py [--data ../../datasets/Sparkov_Data_Generation/data/stream]

Reads events.csv + ground_truth.csv, builds features (features.py), splits BY TIME
(train on the past, test on the future, like production), trains LightGBM, and writes:
  artifacts/fraud_model.onnx   the model, for ONNX Runtime in Java
  artifacts/feature_spec.json  feature order, categories, threshold: what Java must reproduce
  artifacts/metrics.json       test-set precision / recall
"""

import argparse
import json
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import onnxruntime as ort
import pandas as pd
from onnxmltools import convert_lightgbm
from onnxmltools.convert.common.data_types import FloatTensorType
from sklearn.metrics import average_precision_score, precision_recall_curve, roc_auc_score

import features

MODEL_VERSION = "lgbm-v1"


def time_split(df: pd.DataFrame, train_frac: float, valid_frac: float):
    t1, t2 = df["ts_epoch"].quantile([train_frac, train_frac + valid_frac])
    return df["ts_epoch"] < t1, (df["ts_epoch"] >= t1) & (df["ts_epoch"] < t2), df["ts_epoch"] >= t2


def best_f1_threshold(y, p) -> float:
    precision, recall, thresholds = precision_recall_curve(y, p)
    f1 = 2 * precision * recall / np.maximum(precision + recall, 1e-12)
    return float(thresholds[np.argmax(f1[:-1])])


def report(y, p, threshold) -> dict:
    pred = p >= threshold
    tp = int((pred & (y == 1)).sum())
    fp = int((pred & (y == 0)).sum())
    fn = int((~pred & (y == 1)).sum())
    return {
        "rows": int(len(y)),
        "fraud_rows": int(y.sum()),
        "pr_auc": round(float(average_precision_score(y, p)), 4),
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
        "threshold": round(threshold, 4),
        "precision": round(tp / max(tp + fp, 1), 4),
        "recall": round(tp / max(tp + fn, 1), 4),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="../../datasets/Sparkov_Data_Generation/data/stream")
    ap.add_argument("--out", default="artifacts")
    args = ap.parse_args()
    data, out = Path(args.data), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    events = pd.read_csv(data / "events.csv", dtype={"cc_num": str, "txn_id": str})
    labels = pd.read_csv(data / "ground_truth.csv", dtype={"txn_id": str})
    events = events.merge(labels, on="txn_id", how="left", validate="one_to_one")
    events = events.sort_values("ts_epoch", kind="stable").reset_index(drop=True)
    y = events["is_fraud"].fillna(0).astype(int).to_numpy()
    print(f"loaded {len(events):,} events, {y.sum():,} fraud ({y.mean():.2%})")

    categories = sorted(events["category"].unique())
    X = features.build(events, categories)
    names = features.feature_names(categories)
    print(f"built {X.shape[1]} features in {time.time() - t0:.0f}s")

    train, valid, test = time_split(events, 0.7, 0.1)
    neg, pos = (y[train] == 0).sum(), (y[train] == 1).sum()

    model = lgb.LGBMClassifier(
        n_estimators=1000,
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=50,
        subsample=0.8,
        subsample_freq=1,
        colsample_bytree=0.8,
        scale_pos_weight=neg / pos,  # fraud is rare: weight it up
        verbose=-1,
    )
    model.fit(
        X[train].to_numpy(), y[train],
        eval_X=X[valid].to_numpy(),
        eval_y=y[valid],
        eval_metric="average_precision",
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )
    print(f"trained {model.best_iteration_} trees")

    # Threshold chosen on the validation window, judged on the untouched test window.
    threshold = best_f1_threshold(y[valid], model.predict_proba(X[valid].to_numpy())[:, 1])
    p_test = model.predict_proba(X[test].to_numpy())[:, 1]
    metrics = {"model_version": MODEL_VERSION, "test": report(y[test], p_test, threshold)}

    importance = sorted(zip(names, model.booster_.feature_importance("gain")), key=lambda t: -t[1])
    metrics["top_features"] = [n for n, _ in importance[:8]]

    # Export, then check ONNX Runtime gives the same probabilities as LightGBM.
    onnx_model = convert_lightgbm(
        model, initial_types=[("features", FloatTensorType([None, len(names)]))], zipmap=False, target_opset=15
    )
    onnx_path = out / "fraud_model.onnx"
    onnx_path.write_bytes(onnx_model.SerializeToString())
    session = ort.InferenceSession(str(onnx_path))
    sample = X[test].to_numpy()[:5000]
    onnx_p = session.run(None, {"features": sample})[1][:, 1]
    max_diff = float(np.abs(onnx_p - model.predict_proba(sample)[:, 1]).max())
    metrics["onnx_max_abs_diff"] = max_diff
    assert max_diff < 1e-4, f"ONNX output differs from LightGBM by {max_diff}"

    spec = {
        "model_version": MODEL_VERSION,
        "input_name": "features",
        "output": "probabilities[:, 1] = P(fraud)",
        "threshold": round(threshold, 6),
        "missing_value": features.MISSING,
        "features": names,
        "categories": categories,
        "definitions": "see platform/ml/src/features.py; history features use only the card's earlier transactions",
    }
    (out / "feature_spec.json").write_text(json.dumps(spec, indent=2) + "\n")
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")

    print(json.dumps(metrics, indent=2))
    print(f"wrote {onnx_path} ({onnx_path.stat().st_size / 1024:.0f} KB), feature_spec.json, metrics.json")


if __name__ == "__main__":
    main()
