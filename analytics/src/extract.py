from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import pandas as pd

from .db import REPO_ROOT, query_frame, safe_database_label

ANALYTICS_ROOT = REPO_ROOT / "analytics"
OUTPUT_DIR = ANALYTICS_ROOT / "outputs"
BRONZE_DIR = OUTPUT_DIR / "bronze"
SILVER_DIR = OUTPUT_DIR / "silver"
DEMO_CSV = REPO_ROOT / "ai" / "wait_time_module" / "data" / "examples" / "sample_20.csv"

# Enhanced multi-entity extraction query joining tasks, journeys, rooms, queues, specialties, departments, doctors, and equipment
TASK_QUERY = r"""
SELECT
  t.task_id,
  t.journey_id,
  t.journey_step::text,
  t.parent_task_id,
  t.depends_on_task_id,
  t.patient_token,
  t.department_id,
  COALESCE(d.name, dept_r.name) AS department_name,
  t.specialty_id,
  COALESCE(s.name, spec_r.name) AS specialty_name,
  t.queue_id,
  q.name AS queue_name,
  t.room_id,
  r.name AS room_name,
  r.code AS room_code,
  r.floor AS room_floor,
  t.task_type::text,
  t.status::text,
  t.service_type::text,
  t.clinical_priority::text,
  t.readiness_status::text,
  t.scheduling_mode::text,
  t.doctor_id,
  u.full_name AS doctor_name,
  t.device_id,
  eq.name AS device_name,
  t.assigned_at,
  t.arrival_time,
  t.ready_at,
  t.service_start,
  t.service_end,
  t.completed_at,
  t.cancelled_at,
  t.result_ready_at,
  t.result_urgency::text,
  t.result_delay_minutes,
  t.return_timing::text,
  t.schedule_window_start,
  t.schedule_window_end,
  t.sequence_order,
  t.queue_length,
  t.arrival_rate_15m,
  t.avg_service_30m,
  t.resource_status::text,
  t.resource_failure,
  t.doctor_pause,
  t.case_complexity::text,
  t.active_service_duration,
  t.interruption_duration,
  t.elapsed_service_duration,
  t.actual_wait_time,
  t.no_show,
  t.emergency_insertion,
  t.recent_emergency_count,
  j.checkin_at,
  j.severity_score,
  j.intake_source::text,
  t.created_at,
  t.updated_at
FROM patient_journey_tasks t
JOIN patient_journeys j ON j.journey_id = t.journey_id
LEFT JOIN clinic_rooms r ON r.id = t.room_id
LEFT JOIN service_queues q ON q.id = t.queue_id
LEFT JOIN departments d ON d.id = t.department_id
LEFT JOIN clinical_specialties s ON s.id = t.specialty_id
LEFT JOIN clinical_specialties spec_r ON spec_r.id = r.specialty_id
LEFT JOIN departments dept_r ON dept_r.id = spec_r.department_id
LEFT JOIN staff_users u ON u.id = t.doctor_id
LEFT JOIN equipments eq ON eq.id = t.device_id
ORDER BY COALESCE(t.arrival_time, t.ready_at, t.created_at), t.journey_id, t.sequence_order
"""

# Mapping dictionaries for synthetic enrichments when running offline without live joins
SPECIALTY_LOOKUP = {
    "CLINIC-A": ("SPEC-GENERAL-ADULT", "Khám Nội tổng quát", "GENERAL", "Khoa Khám bệnh Tổng quát"),
    "ROOM-GENERAL-101": ("SPEC-GENERAL-ADULT", "Khám Nội tổng quát", "GENERAL", "Khoa Khám bệnh Tổng quát"),
    "ROOM-ER-102": ("SPEC-ER-TRIAGE", "Tiếp nhận và Phân loại cấp cứu", "ER", "Khoa Cấp cứu"),
    "ROOM-CARD-201": ("SPEC-CARD-CONSULT", "Khám Tim mạch", "CARD", "Khoa Tim mạch"),
    "ROOM-NEURO-202": ("SPEC-NEURO-CONSULT", "Khám Thần kinh", "NEURO", "Khoa Thần kinh"),
    "ROOM-ENT-203": ("SPEC-ENT-CONSULT", "Khám Tai Mũi Họng", "ENT", "Khoa Tai Mũi Họng"),
    "ROOM-DERM-204": ("SPEC-DERM-CONSULT", "Khám Da liễu", "DERM", "Khoa Da liễu"),
    "ROOM-PED-301": ("SPEC-PED-CONSULT", "Khám Nhi tổng quát", "PED", "Khoa Nhi"),
    "ROOM-OBGYN-302": ("SPEC-OBGYN-CONSULT", "Khám Sản Phụ khoa", "OBGYN", "Khoa Sản Phụ khoa"),
    "ROOM-ORTHO-303": ("SPEC-ORTHO-CONSULT", "Khám Cơ Xương Khớp", "ORTHO", "Khoa Cơ Xương Khớp"),
    "ROOM-GASTRO-304": ("SPEC-GASTRO-CONSULT", "Khám Tiêu hóa - Gan mật", "GASTRO", "Khoa Tiêu hóa - Gan mật"),
    "ROOM-RESP-401": ("SPEC-RESP-CONSULT", "Khám Hô hấp", "RESP", "Khoa Hô hấp"),
    "ROOM-URO-402": ("SPEC-URO-CONSULT", "Khám Tiết niệu", "URO", "Khoa Tiết niệu"),
    "ROOM-OPH-403": ("SPEC-OPH-CONSULT", "Khám Mắt", "OPH", "Khoa Mắt"),
    "ROOM-ENDO-404": ("SPEC-ENDO-CONSULT", "Khám Nội tiết", "ENDO", "Khoa Nội tiết"),
    "ROOM-PSYCH-405": ("SPEC-PSYCH-CONSULT", "Khám Tâm thần - Tâm lý", "PSYCH", "Khoa Tâm thần - Tâm lý"),
    "ROOM-IMAGING-501": ("SPEC-IMAGING", "Chẩn đoán hình ảnh", "IMAGING", "Khoa Chẩn đoán hình ảnh"),
    "ULTRASOUND-01": ("SPEC-IMAGING", "Chẩn đoán hình ảnh - Siêu âm", "IMAGING", "Khoa Chẩn đoán hình ảnh"),
    "XRAY-01": ("SPEC-IMAGING", "Chẩn đoán hình ảnh - X-quang", "IMAGING", "Khoa Chẩn đoán hình ảnh"),
}

DOCTOR_LOOKUP = {
    "D1": "BS. Nguyễn Văn Nam",
    "D2": "BS. Nguyễn Minh Khang",
    "D3": "BS. Trần Hoàng Lan",
    "D4": "BS. Lê Quang Huy",
    "D5": "BS. Phạm Thu Hà",
    "D6": "BS. Võ Thành Đạt",
    "D7": "BS. Đặng Ngọc Anh",
}


def _anonymize(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    if "patient_token" in result:
        result["patient_alias"] = result["patient_token"].fillna("").map(
            lambda value: "P-" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:10] if value else "P-ANONYMOUS"
        )
        result = result.drop(columns=["patient_token"])
    return result


def _enrich_synthetic_dimensions(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    # Resolve room identifier
    room_col = result["room_id"] if "room_id" in result and result["room_id"].notna().any() else result.get("queue_id", pd.Series(index=result.index, dtype=object))
    
    if "specialty_name" not in result or result["specialty_name"].isna().all():
        specialty_names = []
        dept_names = []
        for r in room_col:
            spec_info = SPECIALTY_LOOKUP.get(str(r), (None, "Khám Chuyên khoa", None, "Khám Chuyên khoa"))
            specialty_names.append(spec_info[1])
            dept_names.append(spec_info[3])
        result["specialty_name"] = specialty_names
        result["department_name"] = dept_names

    if "room_name" not in result or result["room_name"].isna().all():
        result["room_name"] = room_col.fillna("Phòng khám A")

    if "doctor_name" not in result or result["doctor_name"].isna().all():
        if "doctor_id" in result:
            result["doctor_name"] = result["doctor_id"].map(lambda d: DOCTOR_LOOKUP.get(str(d), f"Bác sĩ {d}"))
        else:
            result["doctor_name"] = "BS. Trực lâm sàng"

    if "status" not in result or result["status"].isna().all():
        result["status"] = result.get("readiness_status", pd.Series("COMPLETED", index=result.index)).fillna("COMPLETED")

    return result


def load_tasks(prefer_live: bool = True) -> tuple[pd.DataFrame, str]:
    """Load and return cleansed/anonymized silver-ready task DataFrame and source provenance."""
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
    enriched = _enrich_synthetic_dimensions(demo)
    return _anonymize(enriched), "seeded synthetic CSV: sample_20.csv"


def export_bronze(prefer_live: bool = True) -> dict:
    """Export raw immutable extracted data (Bronze layer)."""
    BRONZE_DIR.mkdir(parents=True, exist_ok=True)
    if prefer_live:
        try:
            raw = query_frame(TASK_QUERY)
            if not raw.empty:
                path = BRONZE_DIR / "raw_tasks.parquet"
                raw.to_parquet(path, index=False)
                return {"layer": "Bronze", "rows": len(raw), "path": str(path), "source": safe_database_label()}
        except Exception:
            pass
    raw = pd.read_csv(DEMO_CSV)
    path = BRONZE_DIR / "raw_tasks.csv"
    raw.to_csv(path, index=False)
    return {"layer": "Bronze", "rows": len(raw), "path": str(path), "source": "synthetic demo CSV"}


def export_tasks(prefer_live: bool = True) -> dict:
    """Export Silver cleansed task fact dataset."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SILVER_DIR.mkdir(parents=True, exist_ok=True)
    frame, source = load_tasks(prefer_live=prefer_live)
    
    # Save standard task_fact.csv and silver parquet
    path_csv = OUTPUT_DIR / "task_fact.csv"
    path_silver_csv = SILVER_DIR / "tasks_silver.csv"
    path_silver_parquet = SILVER_DIR / "tasks_silver.parquet"
    
    frame.to_csv(path_csv, index=False)
    frame.to_csv(path_silver_csv, index=False)
    try:
        frame.to_parquet(path_silver_parquet, index=False)
    except Exception:
        pass
    
    return {
        "rows": len(frame),
        "columns": len(frame.columns),
        "source": source,
        "path": str(path_csv),
        "silver_parquet": str(path_silver_parquet)
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="MedFlow Data Extractor Pipeline")
    parser.add_argument("--demo", action="store_true", help="Skip PostgreSQL and use the seeded CSV")
    parser.add_argument("--bronze", action="store_true", help="Export Bronze layer raw landing zone")
    args = parser.parse_args()
    
    if args.bronze:
        print(export_bronze(prefer_live=not args.demo))
    print(export_tasks(prefer_live=not args.demo))


if __name__ == "__main__":
    main()
