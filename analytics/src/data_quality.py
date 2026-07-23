from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .metrics import TIMESTAMP_COLUMNS, prepare_tasks


def profile_tasks(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    frame = prepare_tasks(raw)
    task_id = frame.get("task_id", pd.Series(index=frame.index, dtype=object))
    checks = []

    def add(check: str, failures: int, severity: str, note: str) -> None:
        checks.append({"check": check, "failures": int(failures), "rate": float(failures / len(frame)) if len(frame) else 0.0, "severity": severity, "note": note})

    add("duplicate task_id", task_id.duplicated(keep=False).sum(), "critical", "Task grain must be unique.")
    add("missing task_id", task_id.isna().sum(), "critical", "Primary task identifier is required.")
    for column in ["journey_id", "task_type", "service_type", "clinical_priority"]:
        if column in frame:
            add(f"missing {column}", frame[column].isna().sum(), "high", "Required analytical dimension.")
    for column in [c for c in TIMESTAMP_COLUMNS if c in raw]:
        invalid = raw[column].notna() & pd.to_datetime(raw[column], utc=True, errors="coerce").isna()
        add(f"invalid timestamp: {column}", invalid.sum(), "high", "Value cannot be parsed as UTC timestamp.")
    add("negative operational wait", (frame["operational_wait_minutes"] < 0).sum(), "high", "Service started before readiness/arrival.")
    add("negative service duration", (frame["service_duration_minutes"] < 0).sum(), "critical", "Service end precedes service start.")
    if {"ready_at", "service_start", "service_end"}.issubset(frame):
        invalid_order = ((frame["service_start"] < frame["ready_at"]) | (frame["service_end"] < frame["service_start"])).fillna(False)
        add("invalid task timestamp order", invalid_order.sum(), "high", "Expected ready <= service start <= service end.")
    allowed_priority = {"EMERGENCY", "URGENT", "NORMAL", "NON_URGENT"}
    if "clinical_priority" in frame:
        add("invalid priority", (~frame["clinical_priority"].isin(allowed_priority) & frame["clinical_priority"].notna()).sum(), "medium", "Outside Prisma enum.")
    if "journey_id" in frame:
        journey_rows = []
        for _, group in frame.groupby("journey_id"):
            starts = pd.concat([group[c] for c in ["checkin_at", "arrival_time"] if c in group], ignore_index=True).dropna()
            ends = pd.concat([group[c] for c in ["completed_at", "service_end"] if c in group], ignore_index=True).dropna()
            if not starts.empty and not ends.empty:
                journey_rows.append((ends.max() - starts.min()).total_seconds() / 60)
        implausible = sum(minutes > 24 * 60 for minutes in journey_rows)
        add("journey duration above 24 hours", implausible, "high", "Likely stale check-in, cross-day demo data, or incomplete event boundary; exclude or investigate before operational use.")
    result = pd.DataFrame(checks)
    summary = {
        "rows": int(len(frame)), "columns": int(len(frame.columns)),
        "quality_checks": int(len(result)), "failed_checks": int((result["failures"] > 0).sum()),
        "critical_or_high_failures": int(result.loc[result["severity"].isin(["critical", "high"]), "failures"].sum()),
    }
    return result, summary


def save_profile(raw: pd.DataFrame, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    checks, summary = profile_tasks(raw)
    checks.to_csv(output_dir / "data_quality_checks.csv", index=False)
    (output_dir / "data_quality_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
