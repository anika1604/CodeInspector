"""
Trains the bug-risk XGBoost classifier on the mined dataset and saves the
artifact to services/ml-risk-service/models/risk_model.joblib.

Usage:
    python train_model.py --data training/dataset.csv
"""
import argparse
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.features import FEATURE_NAMES  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="training/dataset.csv")
    parser.add_argument("--out", default="models/risk_model.joblib")
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    if df.empty:
        raise SystemExit("Dataset is empty — run mine_dataset.py first.")

    X = df[FEATURE_NAMES]
    y = df["label"]

    print(f"Loaded {len(df)} rows, {y.mean():.1%} positive class rate")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42, stratify=y
    )

    # scale_pos_weight compensates for class imbalance (bug-inducing hunks
    # are a minority class in most repos).
    pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=pos_weight,
        eval_metric="auc",
        random_state=42,
    )

    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= 0.5).astype(int)

    auc = roc_auc_score(y_test, probs)
    print(f"\nTest AUC: {auc:.4f}\n")
    print(classification_report(y_test, preds, target_names=["not-risky", "risky"]))

    importances = sorted(
        zip(FEATURE_NAMES, model.feature_importances_), key=lambda x: -x[1]
    )
    print("\nTop feature importances:")
    for name, imp in importances[:8]:
        print(f"  {name:28s} {imp:.4f}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_path)
    print(f"\nSaved model to {out_path}")


if __name__ == "__main__":
    main()
