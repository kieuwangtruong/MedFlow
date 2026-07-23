from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "metrics.yml"
TIMESTAMP_COLUMNS = [
    "checkin_at", "assigned_at", "arrival_time", "ready_at", "service_start",
    "service_end", "completed_at", "cancelled_at", "result_ready_at",
    "schedule_window_start", "schedule_window_end", "created_at", "updated_at",
]


def load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def prepare_tasks(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    for column in TIMESTAMP_COLUMNS:
        if column in result:
            result[column] = pd.to_datetime(result[column], utc=True, errors="coerce")
    for column in ["actual_wait_time", "queue_length", "arrival_rate_15m", "avg_service_30m"]:
        if column in result:
            result[column] = pd.to_numeric(result[column], errors="coerce")

    ready_candidates = [c for c in ["ready_at", "arrival_time"] if c in result]
    if ready_candidates and "service_start" in result:
        operational_base = result[ready_candidates].max(axis=1)
        calculated = (result["service_start"] - operational_base).dt.total_seconds() / 60
    else:
        calculated = pd.Series(np.nan, index=result.index)
    fallback = pd.to_numeric(result.get("actual_wait_time"), errors="coerce") if "actual_wait_time" in result else calculated
    result["operational_wait_minutes"] = calculated.where(calculated.notna(), fallback)
    if "service_start" in result and "arrival_time" in result:
        result["physical_wait_minutes"] = (result["service_start"] - result["arrival_time"]).dt.total_seconds() / 60
    else:
        result["physical_wait_minutes"] = np.nan
    if "service_end" in result and "service_start" in result:
        result["service_duration_minutes"] = (result["service_end"] - result["service_start"]).dt.total_seconds() / 60
    else:
        result["service_duration_minutes"] = np.nan
    if "result_ready_at" in result and "service_end" in result:
        result["result_turnaround_minutes"] = (result["result_ready_at"] - result["service_end"]).dt.total_seconds() / 60
    else:
        result["result_turnaround_minutes"] = np.nan

    sla = load_config()["sla_minutes"]
    priority = result.get("clinical_priority", pd.Series("NORMAL", index=result.index)).fillna("NORMAL")
    result["sla_minutes"] = priority.map(sla).fillna(sla["NORMAL"])
    result["sla_breach"] = result["operational_wait_minutes"] > result["sla_minutes"]
    event_time = result.get("service_start", result.get("arrival_time"))
    if event_time is not None:
        local = event_time.dt.tz_convert(load_config()["timezone"])
        result["event_date"] = local.dt.date
        result["event_hour"] = local.dt.hour
        result["day_of_week"] = local.dt.day_name()
    return result


def percentile_summary(values: pd.Series) -> dict:
    clean = pd.to_numeric(values, errors="coerce").dropna()
    if clean.empty:
        return {"count": 0, "median": np.nan, "p80": np.nan, "p90": np.nan}
    return {
        "count": int(clean.size), "median": float(clean.median()),
        "p80": float(clean.quantile(0.80)), "p90": float(clean.quantile(0.90)),
    }


def journey_summary(tasks: pd.DataFrame) -> pd.DataFrame:
    frame = prepare_tasks(tasks)
    if "journey_id" not in frame:
        return pd.DataFrame()
    rows = []
    for journey_id, group in frame.groupby("journey_id", dropna=False):
        starts = group.get("checkin_at", group.get("arrival_time")).dropna()
        ends = group.get("completed_at", group.get("service_end")).dropna()
        start = starts.min() if not starts.empty else group["arrival_time"].min()
        end = ends.max() if not ends.empty else group["service_end"].max()
        steps = set(group.get("task_type", pd.Series(dtype=str)).dropna())
        rows.append({
            "journey_id": journey_id,
            "journey_completion_minutes": (end - start).total_seconds() / 60 if pd.notna(start) and pd.notna(end) else np.nan,
            "task_count": len(group),
            "completed_tasks": int(group.get("status", pd.Series(index=group.index, dtype=str)).eq("COMPLETED").sum()),
            "has_a_b_return": {"INITIAL_CONSULT", "DIAGNOSTIC_SERVICE", "RETURN_REVIEW"}.issubset(steps),
        })
    return pd.DataFrame(rows)


def kpis(tasks: pd.DataFrame) -> dict:
    frame = prepare_tasks(tasks)
    waits = percentile_summary(frame["operational_wait_minutes"])
    eligible = frame[frame.get("status", pd.Series(index=frame.index, dtype=str)).ne("CANCELLED")]
    journeys = journey_summary(frame)
    return {
        "tasks": int(len(frame)),
        "journeys": int(frame["journey_id"].nunique()) if "journey_id" in frame else 0,
        "median_wait": waits["median"], "p80_wait": waits["p80"], "p90_wait": waits["p90"],
        "sla_breach_rate": float(frame.loc[frame["operational_wait_minutes"].notna(), "sla_breach"].mean()) if frame["operational_wait_minutes"].notna().any() else np.nan,
        "no_show_rate": float(eligible.get("no_show", pd.Series(False, index=eligible.index)).fillna(False).astype(bool).mean()) if len(eligible) else np.nan,
        "completed_tasks": int(frame.get("status", pd.Series(index=frame.index, dtype=str)).eq("COMPLETED").sum()),
        "average_journey_minutes": float(journeys["journey_completion_minutes"].mean()) if not journeys.empty else np.nan,
        "median_journey_minutes": float(journeys["journey_completion_minutes"].median()) if not journeys.empty else np.nan,
    }
