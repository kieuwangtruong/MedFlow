from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "metrics.yml"
TIMESTAMP_COLUMNS = [
    "checkin_at", "assigned_at", "arrival_time", "ready_at", "service_start",
    "service_end", "completed_at", "cancelled_at", "result_ready_at",
    "schedule_window_start", "schedule_window_end", "created_at", "updated_at",
]


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    return {
        "timezone": "Asia/Ho_Chi_Minh",
        "sla_minutes": {
            "EMERGENCY": 5,
            "URGENT": 15,
            "NORMAL": 30,
            "NON_URGENT": 60
        }
    }


def prepare_tasks(frame: pd.DataFrame) -> pd.DataFrame:
    """Prepares and enriches task extract with standardized metrics and temporal features."""
    result = frame.copy()
    for column in TIMESTAMP_COLUMNS:
        if column in result:
            result[column] = pd.to_datetime(result[column], utc=True, errors="coerce")
    for column in ["actual_wait_time", "queue_length", "arrival_rate_15m", "avg_service_30m", "severity_score"]:
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

    cfg = load_config()
    sla = cfg.get("sla_minutes", {"EMERGENCY": 5, "URGENT": 15, "NORMAL": 30, "NON_URGENT": 60})
    priority = result.get("clinical_priority", pd.Series("NORMAL", index=result.index)).fillna("NORMAL")
    result["sla_minutes"] = priority.map(sla).fillna(sla.get("NORMAL", 30))
    result["sla_breach"] = result["operational_wait_minutes"] > result["sla_minutes"]
    
    event_time = result.get("service_start") if "service_start" in result and result["service_start"].notna().any() else result.get("arrival_time")
    if event_time is not None and pd.to_datetime(event_time, errors="coerce").notna().any():
        tz = cfg.get("timezone", "Asia/Ho_Chi_Minh")
        try:
            local = pd.to_datetime(event_time, utc=True).dt.tz_convert(tz)
            result["event_date"] = local.dt.date
            result["event_hour"] = local.dt.hour
            result["day_of_week"] = local.dt.day_name()
            result["is_weekend"] = local.dt.dayofweek.isin([5, 6])
        except Exception:
            result["event_date"] = pd.to_datetime(event_time).dt.date
            result["event_hour"] = pd.to_datetime(event_time).dt.hour
            result["day_of_week"] = pd.to_datetime(event_time).dt.day_name()
            result["is_weekend"] = False
            
    return result


def percentile_summary(values: pd.Series | np.ndarray) -> dict[str, float]:
    """Computes comprehensive distribution statistics: P25, P50, P75, P80, P90, P95, IQR, Skewness, Kurtosis."""
    clean = pd.to_numeric(pd.Series(values), errors="coerce").dropna()
    if clean.empty:
        return {
            "count": 0, "mean": np.nan, "std": np.nan, "min": np.nan,
            "p25": np.nan, "median": np.nan, "p75": np.nan, "p80": np.nan,
            "p90": np.nan, "p95": np.nan, "iqr": np.nan, "skewness": np.nan, "kurtosis": np.nan,
        }
    
    p25 = float(clean.quantile(0.25))
    p75 = float(clean.quantile(0.75))
    skew = float(clean.skew()) if len(clean) > 2 else 0.0
    kurt = float(clean.kurt()) if len(clean) > 3 else 0.0

    return {
        "count": int(clean.size),
        "mean": round(float(clean.mean()), 2),
        "std": round(float(clean.std()), 2),
        "min": round(float(clean.min()), 2),
        "p25": round(p25, 2),
        "median": round(float(clean.median()), 2),
        "p75": round(p75, 2),
        "p80": round(float(clean.quantile(0.80)), 2),
        "p90": round(float(clean.quantile(0.90)), 2),
        "p95": round(float(clean.quantile(0.95)), 2),
        "iqr": round(p75 - p25, 2),
        "skewness": round(skew, 2),
        "kurtosis": round(kurt, 2),
    }


def journey_summary(tasks: pd.DataFrame) -> pd.DataFrame:
    """Aggregates journey metrics including A -> B -> Return bottleneck decomposition."""
    frame = prepare_tasks(tasks)
    if "journey_id" not in frame:
        return pd.DataFrame()
        
    rows = []
    for journey_id, group in frame.groupby("journey_id", dropna=False):
        starts = pd.concat([group[c] for c in ["checkin_at", "arrival_time"] if c in group], ignore_index=True).dropna()
        ends = pd.concat([group[c] for c in ["completed_at", "service_end"] if c in group], ignore_index=True).dropna()
        start = starts.min() if not starts.empty else group["arrival_time"].min() if "arrival_time" in group else None
        end = ends.max() if not ends.empty else group["service_end"].max() if "service_end" in group else None
        
        steps = set(group.get("task_type", pd.Series(dtype=str)).dropna())
        is_a_b_return = {"INITIAL_CONSULT", "DIAGNOSTIC_SERVICE", "RETURN_REVIEW"}.issubset(steps)
        
        # Breakdown wait per step
        wait_initial = group.loc[group["task_type"] == "INITIAL_CONSULT", "operational_wait_minutes"].sum() if "task_type" in group else 0.0
        wait_diagnostic = group.loc[group["task_type"] == "DIAGNOSTIC_SERVICE", "operational_wait_minutes"].sum() if "task_type" in group else 0.0
        wait_return = group.loc[group["task_type"] == "RETURN_REVIEW", "operational_wait_minutes"].sum() if "task_type" in group else 0.0
        turnaround_lab = group.loc[group["task_type"] == "DIAGNOSTIC_SERVICE", "result_turnaround_minutes"].sum() if "task_type" in group else 0.0

        rows.append({
            "journey_id": journey_id,
            "journey_completion_minutes": (end - start).total_seconds() / 60 if pd.notna(start) and pd.notna(end) else np.nan,
            "task_count": len(group),
            "completed_tasks": int(group.get("status", pd.Series(index=group.index, dtype=str)).eq("COMPLETED").sum()),
            "has_a_b_return": is_a_b_return,
            "wait_initial_consult": float(wait_initial),
            "wait_diagnostic_service": float(wait_diagnostic),
            "wait_return_review": float(wait_return),
            "diagnostic_turnaround": float(turnaround_lab),
            "sla_breach_any": bool(group.get("sla_breach", False).any()),
        })
    return pd.DataFrame(rows)


def calculate_specialty_benchmarks(tasks: pd.DataFrame) -> pd.DataFrame:
    """Calculates granular P50, P80, P90 wait times and SLA breach rate per specialty."""
    frame = prepare_tasks(tasks)
    spec_col = "specialty_name" if "specialty_name" in frame and frame["specialty_name"].notna().any() else ("specialty_id" if "specialty_id" in frame else "room_name")
    
    if spec_col not in frame or frame[spec_col].dropna().empty:
        return pd.DataFrame()
        
    benchmarks = []
    for spec, grp in frame.groupby(spec_col):
        stats = percentile_summary(grp["operational_wait_minutes"])
        sla_rate = float(grp["sla_breach"].mean() * 100) if "sla_breach" in grp and grp["sla_breach"].notna().any() else 0.0
        benchmarks.append({
            "specialty": spec,
            "tasks_count": stats["count"],
            "median_wait_min": stats["median"],
            "p80_wait_min": stats["p80"],
            "p90_wait_min": stats["p90"],
            "iqr_min": stats["iqr"],
            "sla_breach_rate_pct": round(sla_rate, 2),
        })
    return pd.DataFrame(benchmarks).sort_values("p90_wait_min", ascending=False)


def kpis(tasks: pd.DataFrame) -> dict[str, Any]:
    """Generates executive scorecards across task and journey grains."""
    frame = prepare_tasks(tasks)
    waits = percentile_summary(frame["operational_wait_minutes"])
    eligible = frame[frame.get("status", pd.Series(index=frame.index, dtype=str)).ne("CANCELLED")]
    journeys = journey_summary(frame)
    
    return {
        "tasks": int(len(frame)),
        "journeys": int(frame["journey_id"].nunique()) if "journey_id" in frame else 0,
        "mean_wait": waits["mean"],
        "median_wait": waits["median"],
        "p80_wait": waits["p80"],
        "p90_wait": waits["p90"],
        "wait_iqr": waits["iqr"],
        "sla_breach_rate": float(frame.loc[frame["operational_wait_minutes"].notna(), "sla_breach"].mean()) if frame["operational_wait_minutes"].notna().any() else np.nan,
        "no_show_rate": float(eligible.get("no_show", pd.Series(False, index=eligible.index)).fillna(False).astype(bool).mean()) if len(eligible) else np.nan,
        "completed_tasks": int(frame.get("status", pd.Series(index=frame.index, dtype=str)).eq("COMPLETED").sum()),
        "average_journey_minutes": float(journeys["journey_completion_minutes"].mean()) if not journeys.empty else np.nan,
        "median_journey_minutes": float(journeys["journey_completion_minutes"].median()) if not journeys.empty else np.nan,
        "a_b_return_count": int(journeys["has_a_b_return"].sum()) if not journeys.empty else 0,
    }
