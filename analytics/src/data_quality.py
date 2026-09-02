from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .metrics import TIMESTAMP_COLUMNS, prepare_tasks


def profile_tasks(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Runs a 16-point enterprise Data Quality inspection suite on task extracts."""
    frame = prepare_tasks(raw)
    total_rows = len(frame)
    task_id = frame.get("task_id", pd.Series(index=frame.index, dtype=object))
    checks: list[dict[str, Any]] = []

    def add_rule(
        rule_id: str,
        check_name: str,
        failures: int,
        severity: str,
        category: str,
        note: str,
        assertion: str,
    ) -> None:
        fail_count = int(failures)
        rate = float(fail_count / total_rows) if total_rows > 0 else 0.0
        passed = fail_count == 0
        checks.append({
            "rule_id": rule_id,
            "check": check_name,
            "category": category,
            "severity": severity,
            "status": "PASSED" if passed else "FAILED",
            "failures": fail_count,
            "failure_rate_pct": round(rate * 100, 2),
            "assertion": assertion,
            "note": note,
        })

    # DQ-01: Unique task_id
    add_rule(
        "DQ-01",
        "duplicate task_id",
        task_id.duplicated(keep=False).sum(),
        "critical",
        "Uniqueness",
        "Task grain must be uniquely identified by task_id.",
        "COUNT(task_id) == COUNT(DISTINCT task_id)"
    )

    # DQ-02: Missing Primary Identifiers
    add_rule(
        "DQ-02",
        "missing task_id",
        task_id.isna().sum(),
        "critical",
        "Completeness",
        "Primary task identifier cannot be null.",
        "task_id IS NOT NULL"
    )

    # DQ-03: PII Masking & Security
    if "patient_token" in raw:
        add_rule(
            "DQ-03",
            "raw patient_token exposed in analytics output",
            raw["patient_token"].notna().sum(),
            "critical",
            "Security & Privacy",
            "Raw patient token must be stripped and replaced by an irreversible SHA-256 alias.",
            "patient_token NOT IN analytics_output"
        )
    elif "patient_alias" in raw:
        valid_alias = raw["patient_alias"].astype("string").str.match(r"^P-[0-9a-f]{10,16}$", na=False)
        add_rule(
            "DQ-03",
            "invalid patient anonymization",
            (~valid_alias).sum(),
            "critical",
            "Security & Privacy",
            "patient_alias must be formatted as P-[sha256_hash_prefix].",
            "patient_alias MATCHES '^P-[0-9a-f]{10,16}$'"
        )
    else:
        add_rule(
            "DQ-03",
            "missing patient identifier alias",
            total_rows,
            "critical",
            "Security & Privacy",
            "Either patient_token or patient_alias must be present.",
            "patient_alias IS NOT NULL"
        )

    # DQ-04: Non-negative Operational Wait Time
    if "operational_wait_minutes" in frame:
        neg_wait = (frame["operational_wait_minutes"] < 0).sum()
        add_rule(
            "DQ-04",
            "negative operational wait",
            neg_wait,
            "high",
            "Validity",
            "Operational wait time cannot be negative (service cannot start before readiness/arrival).",
            "operational_wait_minutes >= 0"
        )

    # DQ-05: Non-negative Service Duration
    if "service_duration_minutes" in frame:
        neg_duration = (frame["service_duration_minutes"] < 0).sum()
        add_rule(
            "DQ-05",
            "negative service duration",
            neg_duration,
            "critical",
            "Validity",
            "Service duration cannot be negative (service_end must be >= service_start).",
            "service_end >= service_start"
        )

    # DQ-06: Chronological Timestamp Ordering
    if {"ready_at", "service_start", "service_end"}.issubset(frame):
        invalid_order = ((frame["service_start"] < frame["ready_at"]) | (frame["service_end"] < frame["service_start"])).fillna(False)
        add_rule(
            "DQ-06",
            "invalid task timestamp order",
            invalid_order.sum(),
            "high",
            "Consistency",
            "Expected chronological progression: ready_at <= service_start <= service_end.",
            "ready_at <= service_start <= service_end"
        )

    # DQ-07: Clinical Priority Enum Conformance
    allowed_priority = {"EMERGENCY", "URGENT", "NORMAL", "NON_URGENT"}
    if "clinical_priority" in frame:
        invalid_pri = (~frame["clinical_priority"].isin(allowed_priority) & frame["clinical_priority"].notna()).sum()
        add_rule(
            "DQ-07",
            "invalid priority",
            invalid_pri,
            "medium",
            "Validity",
            "Clinical priority must match defined triage categories.",
            "clinical_priority IN (EMERGENCY, URGENT, NORMAL, NON_URGENT)"
        )

    # DQ-08: Readiness Status Conformance
    allowed_readiness = {"WAITING", "RESULT_PENDING", "READY", "RETURNING", "ARRIVED", "IN_SERVICE", "COMPLETED", "NO_SHOW_HOLD", "CANCELLED"}
    if "readiness_status" in frame:
        invalid_readiness = (~frame["readiness_status"].isin(allowed_readiness) & frame["readiness_status"].notna()).sum()
        add_rule(
            "DQ-08",
            "invalid readiness_status",
            invalid_readiness,
            "high",
            "Validity",
            "Readiness status must conform to state machine contract.",
            "readiness_status IN valid_states"
        )

    # DQ-09: Resource Attribution for Started Services
    if {"service_start", "doctor_id", "device_id"}.issubset(frame):
        missing_resource = frame["service_start"].notna() & frame["doctor_id"].isna() & frame["device_id"].isna()
        add_rule(
            "DQ-09",
            "service without resource reference",
            missing_resource.sum(),
            "high",
            "Completeness",
            "Any active/started service must reference an assigned doctor or device.",
            "service_start IS NOT NULL -> doctor_id IS NOT NULL OR device_id IS NOT NULL"
        )

    # DQ-10: Actual vs Estimated Timestamp Collision
    actual_estimated_pairs = [
        ("actual_result_ready_at", "estimated_result_ready_at"),
        ("actual_return_arrived_at", "estimated_return_arrived_at"),
        ("actual_service_start_at", "estimated_service_start_at"),
    ]
    collisions = 0
    for actual, estimated in actual_estimated_pairs:
        if actual in frame and estimated in frame:
            collisions += int((frame[actual].notna() & frame[estimated].notna() & (frame[actual] == frame[estimated])).sum())
    add_rule(
        "DQ-10",
        "actual and estimated timestamp collision",
        collisions,
        "high",
        "Integrity",
        "Actual timestamps and estimated forecasts must retain distinct provenance.",
        "actual_timestamp != estimated_timestamp"
    )

    # DQ-11: Acyclic Dependency Graph Check
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
        add_rule(
            "DQ-11",
            "cyclic journey dependency",
            len(cyclic),
            "critical",
            "Integrity",
            "Task dependency graph across journey steps must be acyclic (DAG).",
            "Graph is Acyclic"
        )

    # DQ-12: Upper Bound Check on Journey Duration (24h)
    if "journey_id" in frame:
        journey_rows = []
        for _, group in frame.groupby("journey_id"):
            starts = pd.concat([group[c] for c in ["checkin_at", "arrival_time"] if c in group], ignore_index=True).dropna()
            ends = pd.concat([group[c] for c in ["completed_at", "service_end"] if c in group], ignore_index=True).dropna()
            if not starts.empty and not ends.empty:
                journey_rows.append((ends.max() - starts.min()).total_seconds() / 60)
        implausible = sum(minutes > 24 * 60 for minutes in journey_rows)
        add_rule(
            "DQ-12",
            "journey duration above 24 hours",
            implausible,
            "high",
            "Validity",
            "Journeys exceeding 24 hours indicate stale check-ins or unclosed events.",
            "journey_completion_minutes <= 1440"
        )

    # DQ-13: Service Duration Outlier Check (> 180 min)
    if "service_duration_minutes" in frame:
        long_service = (frame["service_duration_minutes"] > 180).sum()
        add_rule(
            "DQ-13",
            "service duration outlier (> 180 min)",
            long_service,
            "medium",
            "Outlier",
            "Single consultation or diagnostic procedure exceeding 3 hours.",
            "service_duration_minutes <= 180"
        )

    # DQ-14: Missing Mandatory Analytical Dimensions
    for col in ["journey_id", "task_type", "service_type"]:
        if col in frame:
            missing_dim = frame[col].isna().sum()
            add_rule(
                "DQ-14",
                f"missing {col}",
                missing_dim,
                "high",
                "Completeness",
                f"Analytical grouping field {col} must not be null.",
                f"{col} IS NOT NULL"
            )

    # DQ-15: Missing Queue Association
    for col in ["ready_at", "queue_id"]:
        if col in frame:
            missing_q = frame[col].isna().sum()
            add_rule(
                "DQ-15",
                f"missing {col}",
                missing_q,
                "high",
                "Completeness",
                f"Field {col} required for queue eligibility and wait calculation.",
                f"{col} IS NOT NULL"
            )

    # DQ-16: Invalid UTC Timestamp Parsing
    for col in [c for c in TIMESTAMP_COLUMNS if c in raw]:
        invalid_ts = raw[col].notna() & pd.to_datetime(raw[col], utc=True, errors="coerce").isna()
        if invalid_ts.sum() > 0:
            add_rule(
                "DQ-16",
                f"invalid timestamp: {col}",
                invalid_ts.sum(),
                "high",
                "Format",
                f"Column {col} contains unparseable datetime format.",
                f"{col} is valid ISO-8601 UTC timestamp"
            )

    df_checks = pd.DataFrame(checks)
    failed_checks = int((df_checks["failures"] > 0).sum())
    critical_or_high = int(df_checks.loc[df_checks["severity"].isin(["critical", "high"]), "failures"].sum())

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rows": total_rows,
        "columns": int(len(frame.columns)),
        "quality_checks": len(df_checks),
        "passed_checks": int((df_checks["status"] == "PASSED").sum()),
        "failed_checks": failed_checks,
        "critical_or_high_failures": critical_or_high,
        "quality_score_pct": round(float((df_checks["status"] == "PASSED").mean()) * 100, 2) if len(df_checks) else 100.0,
    }

    return df_checks, summary


def save_profile(raw: pd.DataFrame, output_dir: Path) -> dict[str, Any]:
    """Generates quality artifacts (CSV check matrix and JSON report)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    checks, summary = profile_tasks(raw)
    
    checks_path = output_dir / "data_quality_checks.csv"
    checks.to_csv(checks_path, index=False)
    
    summary_path = output_dir / "data_quality_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    
    report_path = output_dir / "data_quality_report.json"
    full_report = {
        "summary": summary,
        "checks": checks.to_dict(orient="records"),
    }
    report_path.write_text(json.dumps(full_report, indent=2), encoding="utf-8")
    
    return summary
