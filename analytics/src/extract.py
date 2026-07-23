from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import pandas as pd

from .db import REPO_ROOT, query_frame, safe_database_label

ANALYTICS_ROOT = REPO_ROOT / "analytics"
OUTPUT_DIR = ANALYTICS_ROOT / "outputs"
DEMO_CSV = REPO_ROOT / "ai" / "wait_time_module" / "data" / "examples" / "sample_20.csv"

TASK_QUERY = r"""
SELECT
  t.task_id, t.journey_id, t.journey_step::text, t.parent_task_id,
  t.depends_on_task_id, t.patient_token, t.department_id, t.specialty_id,
  t.queue_id, t.room_id, r.name AS room_name, r.code AS room_code,
  q.name AS queue_name, t.task_type::text, t.status::text,
  t.service_type::text, t.clinical_priority::text,
  t.readiness_status::text, t.scheduling_mode::text,
  t.doctor_id, t.device_id, t.assigned_at, t.arrival_time, t.ready_at,
  t.service_start, t.service_end, t.completed_at, t.cancelled_at,
  t.result_ready_at, t.result_urgency::text, t.result_delay_minutes,
  t.return_timing::text, t.schedule_window_start, t.schedule_window_end,
  t.sequence_order, t.queue_length, t.arrival_rate_15m, t.avg_service_30m,
  t.resource_status::text, t.resource_failure, t.doctor_pause,
  t.case_complexity::text, t.active_service_duration,
  t.interruption_duration, t.elapsed_service_duration, t.actual_wait_time,
  t.no_show, t.emergency_insertion, t.recent_emergency_count,
  j.checkin_at, j.severity_score, t.created_at, t.updated_at
FROM patient_journey_tasks t
JOIN patient_journeys j ON j.journey_id = t.journey_id
LEFT JOIN clinic_rooms r ON r.id = t.room_id
LEFT JOIN service_queues q ON q.id = t.queue_id
ORDER BY COALESCE(t.arrival_time, t.ready_at, t.created_at), t.journey_id, t.sequence_order
"""


def _anonymize(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    if "patient_token" in result:
        result["patient_alias"] = result["patient_token"].fillna("").map(
            lambda value: "P-" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:10]
        )
        result = result.drop(columns=["patient_token"])
    return result


def load_tasks(prefer_live: bool = True) -> tuple[pd.DataFrame, str]:
    if prefer_live:
        try:
            live = query_frame(TASK_QUERY)
            if not live.empty:
                return _anonymize(live), safe_database_label()
        except Exception:
            pass
    if not DEMO_CSV.exists():
        raise FileNotFoundError(f"No live database and demo file missing: {DEMO_CSV}")
    demo = pd.read_csv(DEMO_CSV)
    return _anonymize(demo), "seeded synthetic CSV: sample_20.csv"


def export_tasks(prefer_live: bool = True) -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frame, source = load_tasks(prefer_live=prefer_live)
    path = OUTPUT_DIR / "task_fact.csv"
    frame.to_csv(path, index=False)
    return {"rows": len(frame), "columns": len(frame.columns), "source": source, "path": str(path)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Skip PostgreSQL and use the seeded CSV")
    args = parser.parse_args()
    print(export_tasks(prefer_live=not args.demo))


if __name__ == "__main__":
    main()

