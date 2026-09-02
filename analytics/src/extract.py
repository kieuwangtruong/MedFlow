from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd

from .db import REPO_ROOT, query_frame, safe_database_label

ANALYTICS_ROOT = REPO_ROOT / "analytics"
OUTPUT_DIR = ANALYTICS_ROOT / "outputs"
BRONZE_DIR = OUTPUT_DIR / "bronze"
SILVER_DIR = OUTPUT_DIR / "silver"
DEMO_CSV = REPO_ROOT / "ai" / "wait_time_module" / "data" / "examples" / "sample_20.csv"

# Comprehensive multi-entity query joining OLTP tables
MULTI_ENTITY_TASK_QUERY = r"""
SELECT
  t.task_id,
  t.journey_id,
  t.journey_step::text AS journey_step,
  t.parent_task_id,
  t.depends_on_task_id,
  t.patient_token,
  t.department_id,
  d.name AS department_name,
  d.code AS department_code,
  t.specialty_id,
  s.name AS specialty_name,
  s.code AS specialty_code,
  t.queue_id,
  q.name AS queue_name,
  t.room_id,
  r.name AS room_name,
  r.code AS room_code,
  r.floor AS room_floor,
  t.task_type::text AS task_type,
  t.status::text AS status,
  t.service_type::text AS service_type,
  t.clinical_priority::text AS clinical_priority,
  t.readiness_status::text AS readiness_status,
  t.scheduling_mode::text AS scheduling_mode,
  t.doctor_id,
  u.full_name AS doctor_name,
  u.role::text AS doctor_role,
  t.device_id,
  t.assigned_at,
  t.arrival_time,
  t.ready_at,
  t.service_start,
  t.service_end,
  t.completed_at,
  t.cancelled_at,
  t.result_ready_at,
  t.result_urgency::text AS result_urgency,
  t.result_delay_minutes,
  t.return_timing::text AS return_timing,
  t.schedule_window_start,
  t.schedule_window_end,
  t.sequence_order,
  t.queue_length,
  t.arrival_rate_15m,
  t.avg_service_30m,
  t.resource_status::text AS resource_status,
  t.resource_failure,
  t.doctor_pause,
  t.case_complexity::text AS case_complexity,
  t.active_service_duration,
  t.interruption_duration,
  t.elapsed_service_duration,
  t.actual_wait_time,
  t.no_show,
  t.emergency_insertion,
  t.recent_emergency_count,
  j.checkin_at,
  j.severity_score,
  j.intake_source::text AS intake_source,
  t.created_at,
  t.updated_at
FROM patient_journey_tasks t
JOIN patient_journeys j ON j.journey_id = t.journey_id
LEFT JOIN clinic_rooms r ON r.id = t.room_id
LEFT JOIN clinical_specialties s ON s.id = t.specialty_id
LEFT JOIN departments d ON d.id = t.department_id
LEFT JOIN service_queues q ON q.id = t.queue_id
LEFT JOIN staff_users u ON u.id = t.doctor_id
ORDER BY COALESCE(t.arrival_time, t.ready_at, t.created_at), t.journey_id, t.sequence_order
"""

DEPENDENCY_QUERY = r"""
SELECT
  id,
  task_id,
  depends_on_task_id,
  created_at
FROM patient_task_dependencies
"""


def anonymize_patient_token(token: str | None) -> str:
    if not token or pd.isna(token):
        return "P-UNKNOWN"
    hashed = hashlib.sha256(str(token).encode("utf-8")).hexdigest()[:10]
    return f"P-{hashed}"


def transform_bronze_to_silver(bronze_df: pd.DataFrame) -> pd.DataFrame:
    silver = bronze_df.copy()
    
    # 1. Mask PII & convert patient_token -> patient_alias
    if "patient_token" in silver:
        silver["patient_alias"] = silver["patient_token"].map(anonymize_patient_token)
        silver = silver.drop(columns=["patient_token"])
    
    # 2. Normalize timestamps to UTC then local timezone (Asia/Ho_Chi_Minh)
    timestamp_cols = [
        "checkin_at", "assigned_at", "arrival_time", "ready_at", "service_start",
        "service_end", "completed_at", "cancelled_at", "result_ready_at",
        "schedule_window_start", "schedule_window_end", "created_at", "updated_at",
    ]
    for col in timestamp_cols:
        if col in silver:
            silver[col] = pd.to_datetime(silver[col], utc=True, errors="coerce")
            
    return silver


def load_tasks(prefer_live: bool = True) -> tuple[pd.DataFrame, str]:
    """Loads tasks and returns silver-grade conformed dataframe + data source string."""
    if prefer_live:
        try:
            live = query_frame(MULTI_ENTITY_TASK_QUERY)
            if not live.empty:
                silver = transform_bronze_to_silver(live)
                return silver, safe_database_label()
        except Exception:
            pass
            
    if not DEMO_CSV.exists():
        raise FileNotFoundError(f"No live database and demo file missing: {DEMO_CSV}")
        
    demo_raw = pd.read_csv(DEMO_CSV)
    silver = transform_bronze_to_silver(demo_raw)
    return silver, "seeded synthetic CSV: sample_20.csv"


def export_pipeline_layers(prefer_live: bool = True) -> dict[str, Any]:
    """Executes ingestion to Bronze, Cleansing to Silver, and exports artifacts."""
    BRONZE_DIR.mkdir(parents=True, exist_ok=True)
    SILVER_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    raw_df: pd.DataFrame
    source_label: str
    
    if prefer_live:
        try:
            raw_df = query_frame(MULTI_ENTITY_TASK_QUERY)
            source_label = safe_database_label()
        except Exception:
            raw_df = pd.read_csv(DEMO_CSV)
            source_label = "seeded synthetic CSV: sample_20.csv"
    else:
        raw_df = pd.read_csv(DEMO_CSV)
        source_label = "seeded synthetic CSV: sample_20.csv"
        
    # Save Bronze (Raw snapshot)
    bronze_path = BRONZE_DIR / "task_fact_raw.csv"
    raw_df.to_csv(bronze_path, index=False)
    
    # Transform & Save Silver (Conformed, masked)
    silver_df = transform_bronze_to_silver(raw_df)
    silver_path = SILVER_DIR / "task_fact_silver.csv"
    silver_df.to_csv(silver_path, index=False)
    
    # Maintain compatibility with task_fact.csv in outputs
    legacy_path = OUTPUT_DIR / "task_fact.csv"
    silver_df.to_csv(legacy_path, index=False)
    
    manifest = {
        "status": "SUCCESS",
        "source": source_label,
        "rows_extracted": len(silver_df),
        "columns_extracted": len(silver_df.columns),
        "bronze_path": str(bronze_path),
        "silver_path": str(silver_path),
        "task_fact_path": str(legacy_path)
    }
    
    manifest_path = OUTPUT_DIR / "ingestion_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    
    return manifest


def export_tasks(prefer_live: bool = True) -> dict:
    manifest = export_pipeline_layers(prefer_live=prefer_live)
    return {
        "rows": manifest["rows_extracted"],
        "columns": manifest["columns_extracted"],
        "source": manifest["source"],
        "path": manifest["task_fact_path"]
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="MedFlow Data Extraction & Ingestion Pipeline")
    parser.add_argument("--demo", action="store_true", help="Skip PostgreSQL and use seeded synthetic CSV")
    args = parser.parse_args()
    result = export_pipeline_layers(prefer_live=not args.demo)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
