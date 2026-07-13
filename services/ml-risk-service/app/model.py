"""
Loads the trained bug-risk classifier and exposes a predict() function.

If no trained model artifact exists yet (i.e. training/train_model.py hasn't
been run), falls back to a transparent weighted-sum heuristic so the service
is still usable end-to-end during initial development/demo. This fallback is
intentionally logged loudly — it should never be silently mistaken for the
real model in a resume writeup or a demo.
"""
import os
import joblib
import numpy as np
from pathlib import Path

from .features import HunkFeatures, FEATURE_NAMES

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "risk_model.joblib"
MODEL_VERSION = os.environ.get("MODEL_VERSION", "heuristic-v0")

_model = None
_using_fallback = True

if MODEL_PATH.exists():
    _model = joblib.load(MODEL_PATH)
    _using_fallback = False
    MODEL_VERSION = os.environ.get("MODEL_VERSION", "xgboost-v1")


_HEURISTIC_WEIGHTS = np.array([
    0.02,   # lines_added
    0.03,   # lines_removed
    0.0,    # net_lines
    0.02,   # churn
    0.25,   # file_extension_risk
    0.20,   # control_flow_density
    0.10,   # risky_keyword_count
    0.001,  # max_line_length
    0.0005, # avg_line_length
    0.08,   # nesting_depth_estimate
    -0.30,  # is_test_file (tests lower risk)
    -0.15,  # comment_ratio
])


def _heuristic_predict(vector: np.ndarray) -> float:
    raw = float(np.dot(vector, _HEURISTIC_WEIGHTS))
    # squash to 0..1
    return 1 / (1 + np.exp(-raw + 1.5))


def predict(features: HunkFeatures) -> tuple[float, str]:
    vector = np.array(features.to_vector(), dtype=float).reshape(1, -1)

    if _model is not None:
        score = float(_model.predict_proba(vector)[0][1])
    else:
        score = float(_heuristic_predict(vector[0]))

    if score < 0.33:
        label = "low"
    elif score < 0.66:
        label = "medium"
    else:
        label = "high"

    return score, label


def model_info() -> dict:
    return {
        "version": MODEL_VERSION,
        "using_fallback_heuristic": _using_fallback,
        "feature_names": FEATURE_NAMES,
    }
