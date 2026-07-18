from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from peak_hour_prediction.app.ml.features import create_features


PROJECT_ROOT = Path(__file__).resolve().parent
DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "checkin_slots_12_months_2025_07_to_2026_06.csv"
)
MODEL_PATH = PROJECT_ROOT / "models" / "checkin_forecast_model.joblib"
METADATA_PATH = PROJECT_ROOT / "models" / "model_metadata.json"

FEATURES = [
    "slot_index",
    "hour",
    "minute",
    "day_of_week",
    "day_of_month",
    "month",
    "week_of_year",
    "is_weekend",
    "is_monday",
    "lag_1_day",
    "lag_7_days",
    "rolling_mean_same_slot_3_days",
    "rolling_std_same_slot_3_days",
]
TARGET = "checkin_count"
PEAK_QUANTILE = 0.8


def build_model() -> RandomForestRegressor:
    return RandomForestRegressor(
        n_estimators=180,
        max_depth=12,
        min_samples_leaf=2,
        n_jobs=1,
        random_state=42,
    )


def main() -> None:
    history = pd.read_csv(DATA_PATH)
    history["checkin_time"] = pd.to_datetime(history["checkin_time"])

    featured = create_features(history).dropna(
        subset=FEATURES + [TARGET]
    )

    validation_start = featured["checkin_time"].max().normalize() - pd.Timedelta(
        days=29
    )
    train = featured[featured["checkin_time"] < validation_start]
    validation = featured[featured["checkin_time"] >= validation_start]

    validation_model = build_model()
    validation_model.fit(train[FEATURES], train[TARGET])
    predictions = np.clip(
        validation_model.predict(validation[FEATURES]),
        0,
        None,
    )

    peak_threshold = float(featured[TARGET].quantile(PEAK_QUANTILE))
    actual_peak = validation[TARGET].to_numpy() >= peak_threshold
    predicted_peak = predictions >= peak_threshold
    true_positive = int(np.sum(actual_peak & predicted_peak))
    false_positive = int(np.sum(~actual_peak & predicted_peak))
    false_negative = int(np.sum(actual_peak & ~predicted_peak))
    precision = true_positive / max(true_positive + false_positive, 1)
    recall = true_positive / max(true_positive + false_negative, 1)
    peak_f1 = 2 * precision * recall / max(precision + recall, 1e-12)

    final_model = build_model()
    final_model.fit(featured[FEATURES], featured[TARGET])
    joblib.dump(final_model, MODEL_PATH)

    metadata = {
        "algorithm": "RandomForestRegressor",
        "features": FEATURES,
        "target": TARGET,
        "slot_minutes": 30,
        "peak_quantile": PEAK_QUANTILE,
        "peak_threshold": peak_threshold,
        "training_data": DATA_PATH.relative_to(PROJECT_ROOT).as_posix(),
        "training_rows": len(featured),
        "date_range": [
            history["checkin_time"].min().date().isoformat(),
            history["checkin_time"].max().date().isoformat(),
        ],
        "validation": {
            "strategy": "last_30_days_holdout",
            "start_date": validation_start.date().isoformat(),
            "rows": len(validation),
            "mae": round(float(mean_absolute_error(validation[TARGET], predictions)), 4),
            "rmse": round(float(mean_squared_error(validation[TARGET], predictions) ** 0.5), 4),
            "r2": round(float(r2_score(validation[TARGET], predictions)), 4),
            "peak_precision": round(precision, 4),
            "peak_recall": round(recall, 4),
            "peak_f1": round(peak_f1, 4),
        },
        "model_params": final_model.get_params(),
        "scikit_learn_version": sklearn.__version__,
        "trained_at": datetime.now(UTC).isoformat(),
    }
    METADATA_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metadata: {METADATA_PATH}")
    print(json.dumps(metadata["validation"], indent=2))


if __name__ == "__main__":
    main()
