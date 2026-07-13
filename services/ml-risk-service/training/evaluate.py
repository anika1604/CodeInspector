"""
Standalone evaluation of the trained risk model — produces the metrics
you'll want for a resume/portfolio writeup: AUC, precision/recall at
several thresholds, and a confusion matrix. Also compares against the
heuristic fallback so you have a genuine "classical ML vs. heuristic"
ablation data point.

Usage:
    python evaluate.py --data training/dataset.csv --model models/risk_model.joblib
"""
import argparse
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, precision_recall_curve, confusion_matrix, f1_score,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.features import FEATURE_NAMES  # noqa: E402
from app.model import _heuristic_predict  # noqa: E402


def evaluate(y_true, probs, name: str):
    auc = roc_auc_score(y_true, probs)
    precisions, recalls, thresholds = precision_recall_curve(y_true, probs)

    print(f"\n=== {name} ===")
    print(f"AUC: {auc:.4f}")

    for target_thresh in [0.33, 0.5, 0.66]:
        preds = (probs >= target_thresh).astype(int)
        cm = confusion_matrix(y_true, preds)
        f1 = f1_score(y_true, preds)
        print(f"  threshold={target_thresh}: F1={f1:.3f}  confusion_matrix={cm.tolist()}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="training/dataset.csv")
    parser.add_argument("--model", default="models/risk_model.joblib")
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    X = df[FEATURE_NAMES]
    y = df["label"]

    model = joblib.load(args.model)
    model_probs = model.predict_proba(X)[:, 1]
    evaluate(y, model_probs, "XGBoost model")

    heuristic_probs = np.array([_heuristic_predict(row) for row in X.values])
    evaluate(y, heuristic_probs, "Heuristic baseline")


if __name__ == "__main__":
    main()
