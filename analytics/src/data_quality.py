from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .metrics import TIMESTAMP_COLUMNS, prepare_tasks


def profile_tasks(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Execute 18+ comprehensive Data Quality Rules adhering to DAMA-DMBOK dimensions."""
    frame = prepare_tasks(raw)
    task_id = frame.get("task_id", pd.Series(index=frame.index, dtype=object))
    checks = []

    def add(check: str, failures: int, severity: str, note: str, dimension: str = "Validity") -> None:
        checks.append({
            "check": check,
            "dimension": dimension,
            "failures": int(failures),
            "rate": float(failures / len(frame)) if len(frame) else 0.0,
            "severity": severity,
            "note": note,
            "status": "PASSED" if failures == 0 else ("WARNING" if severity == "medium" else "FAILED")
        })

    # 1. Uniqueness & Primary Key Grain
    add("duplicate task_id", task_id.duplicated(keep=False).sum(), "critical", "Task grain must be unique.", "Uniqueness")
    
    if "event_id" in frame:
        add("duplicate event_id", frame["event_id"].dropna().duplicated(keep=False).sum(), "critical", "Event journal identifiers must be unique.", "Uniqueness")
    else:
        add("duplicate event_id", 0, "critical", "Not evaluated: task extract does not contain event_id; validate on event-journal extract.", "Uniqueness")

    # 2. Completeness & Mandatory Dimension Checks
    add("missing task_id", task_id.isna().sum(), "critical", "Primary task identifier is required.", "Completeness")
    for column in ["journey_id", "task_type", "service_type", "clinical_priority"]:
        if column in frame:
            add(f"missing {column}", frame[column].isna().sum(), "high", f"Required analytical dimension '{column}'.", "Completeness")
    
    for column in ["ready_at", "queue_id"]:
        if column in frame:
            add(f"missing {column}", frame[column].isna().sum(), "high", f"Required for queue eligibility and wait-time calculation '{column}'.", "Completeness")

    # 3. Conformity & Timestamp Format Parsing
    for column in [c for c in TIMESTAMP_COLUMNS if c in raw]:
        invalid = raw[column].notna() & pd.to_datetime(raw[column], utc=True, errors="coerce").isna()
        add(f"invalid timestamp: {column}", invalid.sum(), "high", f"Value cannot be parsed as valid UTC timestamp: '{column}'.", "Conformity")

    # 4. Accuracy & Physical/Operational Plausibility
    add("negative operational wait", (frame["operational_wait_minutes"] < 0).sum(), "high", "Service started before readiness/arrival.", "Accuracy")
    if "physical_wait_minutes" in frame:
        add("negative physical wait", (frame["physical_wait_minutes"] < 0).sum(), "high", "Service started before physical arrival.", "Accuracy")
    add("negative service duration", (frame["service_duration_minutes"] < 0).sum(), "critical", "Service end precedes service start.", "Accuracy")

    # 5. Consistency & Chronological Sequence Logic
    if {"ready_at", "service_start", "service_end"}.issubset(frame):
        invalid_order = ((frame["service_start"] < frame["ready_at"]) | (frame["service_end"] < frame["service_start"])).fillna(False)
        add("invalid task timestamp order", invalid_order.sum(), "high", "Expected ready_at <= service_start <= service_end.", "Consistency")

    if {"checkin_at", "arrival_time"}.issubset(frame):
        invalid_checkin = (frame["arrival_time"] < frame["checkin_at"]).fillna(False)
        add("invalid checkin vs arrival order", invalid_checkin.sum(), "medium", "Arrival at clinic room preceded overall journey check-in.", "Consistency")

    # 6. Validity & Enum Constraints
    allowed_priority = {"EMERGENCY", "URGENT", "NORMAL", "NON_URGENT"}
    if "clinical_priority" in frame:
        add("invalid priority", (~frame["clinical_priority"].isin(allowed_priority) & frame["clinical_priority"].notna()).sum(), "medium", "Priority value outside Prisma schema enum.", "Validity")

    allowed_readiness = {"WAITING", "RESULT_PENDING", "READY", "RETURNING", "ARRIVED", "IN_SERVICE", "COMPLETED", "NO_SHOW_HOLD", "CANCELLED"}
    if "readiness_status" in frame:
        invalid = ~frame["readiness_status"].isin(allowed_readiness) & frame["readiness_status"].notna()
        add("invalid readiness_status", invalid.sum(), "high", "Readiness state outside Wait-Time state contract.", "Validity")

    # 7. Referential Integrity & Resource Binding
    if {"service_start", "doctor_id", "device_id"}.issubset(frame):
        missing_resource = frame["service_start"].notna() & frame["doctor_id"].isna() & frame["device_id"].isna()
        add("service without resource reference", missing_resource.sum(), "high", "Started service must reference an assigned doctor or equipment device.", "Integrity")

    # 8. Provenance Separation (Actual vs Estimated)
    actual_estimated_pairs = [
        ("actual_result_ready_at", "estimated_result_ready_at"),
        ("actual_return_arrived_at", "estimated_return_arrived_at"),
        ("actual_service_start_at", "estimated_service_start_at"),
    ]
    collisions = 0
    for actual, estimated in actual_estimated_pairs:
        if actual in frame and estimated in frame:
            collisions += int((frame[actual].notna() & frame[estimated].notna() & (frame[actual] == frame[estimated])).sum())
    add("actual and estimated timestamp collision", collisions, "high", "Actual and estimated timestamps must retain distinct provenance.", "Integrity")

    # 9. Directed Acyclic Graph (DAG) Acyclic Integrity
    if {"task_id", "depends_on_task_id"}.issubset(frame):
        dependency = dict(zip(frame["task_id"].dropna().astype(str), frame.loc[frame["task_id"].notna(), "depends_on_task_id"]))
        cyclic = set()
        for start in dependency:
            path, seen, current = [], set(), start
            while pd.notna(current) and str(current) in dependency:
                current = str(current)
                if current in seen:
                    cyclic.update(path[path.index(current):])
                    break
                seen.add(current)
                path.append(current)
                current = dependency.get(current)
        add("cyclic journey dependency", len(cyclic), "critical", "Task dependency graph must be strictly acyclic (DAG).", "Integrity")

    # 10. Privacy & PII Protection Compliance
    if "patient_token" in raw:
        add("raw patient_token exposed in analytics output", raw["patient_token"].notna().sum(), "critical", "Published analytics output must contain only irreversible patient_alias (SHA-256).", "Privacy")
    elif "patient_alias" in raw:
        valid_alias = raw["patient_alias"].astype("string").str.match(r"^P-[0-9a-fA-F]{8,16}$|^P-ANONYMOUS$", na=False)
        add("invalid patient anonymization", (~valid_alias).sum(), "critical", "patient_alias must be a truncated SHA-256 alias; raw token is strictly forbidden.", "Privacy")

    # 11. Outlier & Anomaly Detection
    if "service_duration_minutes" in frame:
        extreme_duration = (frame["service_duration_minutes"] > 180).sum()
        add("service duration above 180 minutes", extreme_duration, "medium", "Consultation/Diagnostic session exceeded 3 hours; review for outlier or paused session.", "Accuracy")

    if "journey_id" in frame:
        journey_rows = []
        for _, group in frame.groupby("journey_id"):
            starts = pd.concat([group[c] for c in ["checkin_at", "arrival_time"] if c in group], ignore_index=True).dropna()
            ends = pd.concat([group[c] for c in ["completed_at", "service_end"] if c in group], ignore_index=True).dropna()
            if not starts.empty and not ends.empty:
                journey_rows.append((ends.max() - starts.min()).total_seconds() / 60)
        implausible = sum(minutes > 24 * 60 for minutes in journey_rows)
        add("journey duration above 24 hours", implausible, "high", "Likely stale check-in, cross-day demo data, or incomplete event boundary.", "Accuracy")

    result = pd.DataFrame(checks)
    summary = {
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "quality_checks": int(len(result)),
        "passed_checks": int((result["failures"] == 0).sum()),
        "failed_checks": int((result["failures"] > 0).sum()),
        "critical_failures": int(result.loc[result["severity"] == "critical", "failures"].sum()),
        "high_failures": int(result.loc[result["severity"] == "high", "failures"].sum()),
        "medium_failures": int(result.loc[result["severity"] == "medium", "failures"].sum()),
        "critical_or_high_failures": int(result.loc[result["severity"].isin(["critical", "high"]), "failures"].sum()),
        "data_quality_score": round(float((result["failures"] == 0).mean() * 100), 2) if len(result) else 100.0,
    }
    return result, summary


def save_profile(raw: pd.DataFrame, output_dir: Path) -> dict:
    """Save comprehensive data quality check table and summary reports."""
    output_dir.mkdir(parents=True, exist_ok=True)
    checks, summary = profile_tasks(raw)
    checks.to_csv(output_dir / "data_quality_checks.csv", index=False)
    (output_dir / "data_quality_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (output_dir / "data_quality_report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    from .extract import load_tasks
    tasks, _ = load_tasks()
    output = Path(__file__).resolve().parents[1] / "outputs"
    summary = save_profile(tasks, output)
    print("=== Data Quality Verification Summary ===")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
