from __future__ import annotations

from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd

from ..ml.features import create_features


def create_future_day(
    last_timestamp: pd.Timestamp,
) -> pd.DataFrame:
    next_date = (
        last_timestamp.normalize()
        + timedelta(days=1)
    )

    rows: list[dict] = []

    for slot_index in range(20):
        timestamp = next_date + timedelta(
            hours=7,
            minutes=slot_index * 30,
        )

        rows.append(
            {
                "checkin_time": timestamp,
                "slot_index": slot_index,
                "checkin_count": np.nan,
            }
        )

    return pd.DataFrame(rows)


def classify_peak(
    predicted_count: float,
    threshold: float,
) -> str:
    if predicted_count >= threshold * 1.2:
        return "very_high"

    if predicted_count >= threshold:
        return "high"

    if predicted_count >= threshold * 0.65:
        return "normal"

    return "low"


def forecast_multiple_days(
    history: pd.DataFrame,
    model: Any,
    features: list[str],
    peak_threshold: float,
    days: int,
) -> pd.DataFrame:
    working_history = history[
        [
            "checkin_time",
            "slot_index",
            "checkin_count",
        ]
    ].copy()

    forecast_results: list[pd.DataFrame] = []

    for _ in range(days):
        last_timestamp = pd.to_datetime(
            working_history["checkin_time"]
        ).max()

        future_day = create_future_day(
            last_timestamp
        )

        combined = pd.concat(
            [working_history, future_day],
            ignore_index=True,
        )

        feature_df = create_features(combined)

        forecast_date = (
            future_day["checkin_time"]
            .dt.date.iloc[0]
        )

        future_features = feature_df[
            feature_df["checkin_time"].dt.date
            == forecast_date
        ].copy()

        missing_columns = future_features[
            features
        ].columns[
            future_features[features].isna().any()
        ].tolist()

        if missing_columns:
            raise ValueError(
                "Không đủ dữ liệu lịch sử cho feature: "
                + ", ".join(missing_columns)
            )

        predictions = model.predict(
            future_features[features]
        )

        predictions = np.clip(
            predictions,
            0,
            None,
        )

        result = future_features[
            ["checkin_time", "slot_index"]
        ].copy()

        result["predicted_checkin_count"] = (
            predictions.round(2)
        )

        result["is_peak"] = (
            predictions >= peak_threshold
        )

        result["peak_level"] = [
            classify_peak(value, peak_threshold)
            for value in predictions
        ]

        forecast_results.append(result)

        predicted_history = future_day.copy()

        predicted_history["checkin_count"] = (
            predictions
        )

        working_history = pd.concat(
            [
                working_history,
                predicted_history,
            ],
            ignore_index=True,
        )

    return pd.concat(
        forecast_results,
        ignore_index=True,
    )
