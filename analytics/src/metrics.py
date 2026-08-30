from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from scipy import stats

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
    for column in ["actual_wait_time", "queue_length", "arrival_rate_15m", "avg_service_30m", "active_service_duration", "interruption_duration", "elapsed_service_duration"]:
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
    result["sla_minutes"] = priority.map(sla).fillna(sla.get("NORMAL", 30))
    result["sla_breach"] = result["operational_wait_minutes"] > result["sla_minutes"]
    
    event_time = result.get("service_start", result.get("arrival_time"))
    if event_time is not None and event_time.notna().any():
        try:
            local = event_time.dt.tz_convert(load_config()["timezone"])
            result["event_date"] = local.dt.date
            result["event_hour"] = local.dt.hour
            result["day_of_week"] = local.dt.day_name()
        except Exception:
            pass
    return result


def percentile_summary(values: pd.Series) -> dict:
    clean = pd.to_numeric(values, errors="coerce").dropna()
    if clean.empty:
        return {"count": 0, "mean": np.nan, "median": np.nan, "p80": np.nan, "p90": np.nan, "iqr": np.nan}
    p25 = float(clean.quantile(0.25))
    p75 = float(clean.quantile(0.75))
    return {
        "count": int(clean.size),
        "mean": float(clean.mean()),
        "median": float(clean.median()),
        "p80": float(clean.quantile(0.80)),
        "p90": float(clean.quantile(0.90)),
        "iqr": float(p75 - p25),
    }


def statistical_distribution_summary(values: pd.Series) -> dict:
    """Calculate advanced statistical moments, IQR, skewness, and kurtosis."""
    clean = pd.to_numeric(values, errors="coerce").dropna()
    if clean.empty or len(clean) < 2:
        return {
            "count": int(len(clean)), "mean": np.nan, "std": np.nan,
            "median": np.nan, "p25": np.nan, "p75": np.nan, "p80": np.nan, "p90": np.nan, "p95": np.nan,
            "iqr": np.nan, "skewness": np.nan, "kurtosis": np.nan, "cv": np.nan,
        }
    p25, p75 = float(clean.quantile(0.25)), float(clean.quantile(0.75))
    mean_val = float(clean.mean())
    std_val = float(clean.std(ddof=1))
    return {
        "count": int(clean.size),
        "mean": round(mean_val, 2),
        "std": round(std_val, 2),
        "median": round(float(clean.median()), 2),
        "p25": round(p25, 2),
        "p75": round(p75, 2),
        "p80": round(float(clean.quantile(0.80)), 2),
        "p90": round(float(clean.quantile(0.90)), 2),
        "p95": round(float(clean.quantile(0.95)), 2),
        "iqr": round(p75 - p25, 2),
        "skewness": round(float(stats.skew(clean, bias=False)), 2) if len(clean) >= 3 else 0.0,
        "kurtosis": round(float(stats.kurtosis(clean, bias=False)), 2) if len(clean) >= 4 else 0.0,
        "cv": round(std_val / mean_val, 3) if mean_val != 0 else 0.0,
    }


def specialty_performance_breakdown(tasks: pd.DataFrame) -> pd.DataFrame:
    """Compute detailed P50, P80, P90 percentiles and SLA compliance across clinical specialties."""
    frame = prepare_tasks(tasks)
    col = "specialty_name" if "specialty_name" in frame and frame["specialty_name"].notna().any() else ("service_type" if "service_type" in frame else "room_name")
    
    rows = []
    for name, grp in frame.groupby(col):
        waits = grp["operational_wait_minutes"].dropna()
        serv = grp["service_duration_minutes"].dropna()
        sla_rate = grp["sla_breach"].mean() if grp["sla_breach"].notna().any() else 0.0
        
        rows.append({
            "specialty_or_service": str(name),
            "total_tasks": len(grp),
            "completed_tasks": int(grp.get("status", pd.Series(index=grp.index)).eq("COMPLETED").sum()),
            "median_wait_p50": float(waits.median()) if not waits.empty else np.nan,
            "wait_p80": float(waits.quantile(0.80)) if not waits.empty else np.nan,
            "wait_p90": float(waits.quantile(0.90)) if not waits.empty else np.nan,
            "mean_wait": float(waits.mean()) if not waits.empty else np.nan,
            "median_service_duration": float(serv.median()) if not serv.empty else np.nan,
            "sla_breach_rate": float(sla_rate),
            "sla_compliance_rate": float(1.0 - sla_rate),
        })
    return pd.DataFrame(rows).sort_values("total_tasks", ascending=False)


def sla_performance_by_priority(tasks: pd.DataFrame) -> pd.DataFrame:
    """Analyze SLA breach rates and percentiles categorized by Clinical Priority."""
    frame = prepare_tasks(tasks)
    rows = []
    for priority, grp in frame.groupby("clinical_priority"):
        waits = grp["operational_wait_minutes"].dropna()
        target = grp["sla_minutes"].iloc[0] if "sla_minutes" in grp else 30.0
        breach_count = int(grp["sla_breach"].sum())
        total = len(grp)
        rows.append({
            "clinical_priority": str(priority),
            "total_tasks": total,
            "sla_target_minutes": float(target),
            "median_wait": float(waits.median()) if not waits.empty else np.nan,
            "p80_wait": float(waits.quantile(0.80)) if not waits.empty else np.nan,
            "p90_wait": float(waits.quantile(0.90)) if not waits.empty else np.nan,
            "breach_count": breach_count,
            "sla_breach_rate": float(breach_count / total) if total else 0.0,
            "sla_compliance_rate": float(1.0 - (breach_count / total)) if total else 1.0,
        })
    return pd.DataFrame(rows).sort_values("sla_target_minutes")


def bottleneck_3step_analysis(tasks: pd.DataFrame) -> dict:
    """Deep bottleneck analysis of the initial -> diagnostic -> return review loop."""
    frame = prepare_tasks(tasks)
    step_stats = {}
    for step in ["INITIAL_CONSULT", "DIAGNOSTIC_SERVICE", "RETURN_REVIEW"]:
        sub = frame[frame.get("task_type") == step]
        waits = sub["operational_wait_minutes"].dropna()
        serv = sub["service_duration_minutes"].dropna()
        step_stats[step] = {
            "task_count": len(sub),
            "median_wait": float(waits.median()) if not waits.empty else np.nan,
            "p80_wait": float(waits.quantile(0.80)) if not waits.empty else np.nan,
            "p90_wait": float(waits.quantile(0.90)) if not waits.empty else np.nan,
            "median_duration": float(serv.median()) if not serv.empty else np.nan,
        }
    
    diagnostic_turnaround = frame["result_turnaround_minutes"].dropna()
    return {
        "step_metrics": step_stats,
        "result_turnaround_p50": float(diagnostic_turnaround.median()) if not diagnostic_turnaround.empty else np.nan,
        "result_turnaround_p80": float(diagnostic_turnaround.quantile(0.80)) if not diagnostic_turnaround.empty else np.nan,
        "result_turnaround_p90": float(diagnostic_turnaround.quantile(0.90)) if not diagnostic_turnaround.empty else np.nan,
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
        total_wait = group["operational_wait_minutes"].sum(skipna=True)
        rows.append({
            "journey_id": journey_id,
            "journey_completion_minutes": (end - start).total_seconds() / 60 if pd.notna(start) and pd.notna(end) else np.nan,
            "total_wait_minutes": float(total_wait),
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
        "median_wait": waits["median"],
        "p80_wait": waits["p80"],
        "p90_wait": waits["p90"],
        "sla_breach_rate": float(frame.loc[frame["operational_wait_minutes"].notna(), "sla_breach"].mean()) if frame["operational_wait_minutes"].notna().any() else 0.0,
        "no_show_rate": float(eligible.get("no_show", pd.Series(False, index=eligible.index)).fillna(False).astype(bool).mean()) if len(eligible) else 0.0,
        "completed_tasks": int(frame.get("status", pd.Series(index=frame.index, dtype=str)).eq("COMPLETED").sum()),
        "average_journey_minutes": float(journeys["journey_completion_minutes"].mean()) if not journeys.empty else np.nan,
        "median_journey_minutes": float(journeys["journey_completion_minutes"].median()) if not journeys.empty else np.nan,
    }
