from __future__ import annotations

import argparse
import json
from datetime import datetime, time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .extract import load_tasks
from .metrics import prepare_tasks

ANALYTICS_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ANALYTICS_ROOT / "outputs"
DATAMART_DIR = OUTPUT_DIR / "datamart"


def build_dim_date(start_date: str = "2026-01-01", end_date: str = "2026-12-31") -> pd.DataFrame:
    """Builds enterprise Date Dimension table."""
    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    df = pd.DataFrame({"full_date": dates})
    df["date_key"] = df["full_date"].dt.strftime("%Y%m%d").astype(int)
    df["day_of_week"] = df["full_date"].dt.dayofweek + 1  # 1 = Monday, 7 = Sunday
    df["day_name"] = df["full_date"].dt.day_name()
    df["day_of_month"] = df["full_date"].dt.day
    df["month"] = df["full_date"].dt.month
    df["month_name"] = df["full_date"].dt.month_name()
    df["quarter"] = df["full_date"].dt.quarter
    df["year"] = df["full_date"].dt.year
    df["is_weekend"] = df["day_of_week"].isin([6, 7])
    df["full_date"] = df["full_date"].dt.date
    return df


def build_dim_time_slot() -> pd.DataFrame:
    """Builds 30-minute interval Time Slot Dimension table."""
    slots = []
    slot_index = 0
    for hour in range(24):
        for minute in (0, 30):
            start_str = f"{hour:02d}:{minute:02d}"
            end_min = (minute + 30) % 60
            end_hour = hour + 1 if minute == 30 else hour
            end_str = f"{end_hour:02d}:{end_min:02d}"
            slot_key = hour * 100 + minute
            is_peak = 8 <= hour <= 11 or 13 <= hour <= 16
            slots.append({
                "time_slot_key": slot_key,
                "slot_index_30m": slot_index,
                "slot_label": f"{start_str} - {end_str}",
                "slot_start": start_str,
                "slot_end": end_str,
                "hour_of_day": hour,
                "minute_of_hour": minute,
                "is_peak_hour": is_peak,
            })
            slot_index += 1
    return pd.DataFrame(slots)


def build_star_schema(silver_tasks: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Transforms Silver conformed tasks into a normalized Gold Star Schema."""
    tasks = prepare_tasks(silver_tasks)
    
    # 1. Dim Patient
    patient_aliases = tasks["patient_alias"].dropna().unique() if "patient_alias" in tasks else []
    dim_patient = pd.DataFrame({"patient_alias": patient_aliases})
    dim_patient["patient_key"] = range(1, len(dim_patient) + 1)
    dim_patient["status"] = "ACTIVE"
    dim_patient["age_group"] = "ADULT"
    patient_map = dict(zip(dim_patient["patient_alias"], dim_patient["patient_key"]))
    
    # 2. Dim Doctor
    doctors = tasks[["doctor_id", "doctor_name", "doctor_role"]].dropna(subset=["doctor_id"]).drop_duplicates() if "doctor_name" in tasks else pd.DataFrame(columns=["doctor_id", "doctor_name", "doctor_role"])
    if doctors.empty and "doctor_id" in tasks:
        doc_ids = tasks["doctor_id"].dropna().unique()
        doctors = pd.DataFrame({"doctor_id": doc_ids, "doctor_name": [f"Dr. {did}" for did in doc_ids], "doctor_role": "DOCTOR"})
    if not doctors.empty:
        doctors["doctor_key"] = range(1, len(doctors) + 1)
    else:
        doctors = pd.DataFrame(columns=["doctor_key", "doctor_id", "doctor_name", "doctor_role"])
    doctor_map = dict(zip(doctors["doctor_id"], doctors["doctor_key"])) if not doctors.empty else {}
    
    # 3. Dim Clinic Room
    room_cols = [c for c in ["room_id", "room_name", "room_code", "room_floor"] if c in tasks]
    if "room_id" in tasks:
        rooms = tasks[room_cols].dropna(subset=["room_id"]).drop_duplicates()
        if "room_name" not in rooms:
            rooms["room_name"] = rooms["room_id"]
        if "room_code" not in rooms:
            rooms["room_code"] = rooms["room_id"]
        if "room_floor" not in rooms:
            rooms["room_floor"] = "1"
        rooms["clinic_room_key"] = range(1, len(rooms) + 1)
        rooms["is_active"] = True
    else:
        rooms = pd.DataFrame(columns=["clinic_room_key", "room_id", "room_name", "room_code", "room_floor", "is_active"])
    room_map = dict(zip(rooms["room_id"], rooms["clinic_room_key"])) if not rooms.empty else {}
    
    # 4. Dim Specialty
    spec_cols = [c for c in ["specialty_id", "specialty_name", "specialty_code", "department_name"] if c in tasks]
    if "specialty_id" in tasks:
        specialties = tasks[spec_cols].dropna(subset=["specialty_id"]).drop_duplicates()
        if "specialty_name" not in specialties:
            specialties["specialty_name"] = specialties["specialty_id"]
        if "department_name" not in specialties:
            specialties["department_name"] = "Khối Lâm Sàng"
        specialties["specialty_key"] = range(1, len(specialties) + 1)
    else:
        specialties = pd.DataFrame(columns=["specialty_key", "specialty_id", "specialty_name", "department_name"])
    spec_map = dict(zip(specialties["specialty_id"], specialties["specialty_key"])) if not specialties.empty else {}
    
    # 5. Dim Date & Dim Time Slot
    dim_date = build_dim_date()
    dim_time_slot = build_dim_time_slot()
    
    # 6. Fact Task Execution
    fact_task = tasks.copy()
    fact_task["task_execution_key"] = range(1, len(fact_task) + 1)
    fact_task["patient_key"] = fact_task["patient_alias"].map(patient_map).fillna(-1).astype(int)
    fact_task["doctor_key"] = fact_task["doctor_id"].map(doctor_map).fillna(-1).astype(int) if "doctor_id" in fact_task else -1
    fact_task["clinic_room_key"] = fact_task["room_id"].map(room_map).fillna(-1).astype(int) if "room_id" in fact_task else -1
    fact_task["specialty_key"] = fact_task["specialty_id"].map(spec_map).fillna(-1).astype(int) if "specialty_id" in fact_task else -1
    
    # Date key mapping from event_date
    if "event_date" in fact_task:
        fact_task["date_key"] = pd.to_datetime(fact_task["event_date"]).dt.strftime("%Y%m%d").fillna(20260101).astype(int)
    else:
        fact_task["date_key"] = 20260101
        
    # Time slot key mapping from event_hour & arrival_time minute
    if "arrival_time" in fact_task and fact_task["arrival_time"].notna().any():
        hour = fact_task["arrival_time"].dt.hour.fillna(8).astype(int)
        minute = (fact_task["arrival_time"].dt.minute.fillna(0) // 30 * 30).astype(int)
        fact_task["time_slot_key"] = hour * 100 + minute
    else:
        fact_task["time_slot_key"] = 800
        
    fact_task["is_sla_breach"] = fact_task.get("sla_breach", False).astype(int)
    fact_task["resource_failure_flag"] = fact_task.get("resource_failure", False).fillna(False).astype(int)
    fact_task["emergency_insertion_flag"] = fact_task.get("emergency_insertion", False).fillna(False).astype(int)
    
    # Select cleanest star schema columns for fact_task
    fact_task_cols = [
        "task_execution_key", "task_id", "journey_id", "patient_key", "clinic_room_key",
        "doctor_key", "specialty_key", "date_key", "time_slot_key", "task_type",
        "service_type", "clinical_priority", "status", "operational_wait_minutes",
        "physical_wait_minutes", "service_duration_minutes", "result_turnaround_minutes",
        "is_sla_breach", "resource_failure_flag", "emergency_insertion_flag", "queue_length"
    ]
    fact_task_clean = fact_task[[c for c in fact_task_cols if c in fact_task]]
    
    # 7. Fact Patient Journey
    journey_rows = []
    journey_idx = 1
    if "journey_id" in tasks:
        for j_id, grp in tasks.groupby("journey_id"):
            p_alias = grp["patient_alias"].iloc[0] if "patient_alias" in grp else None
            p_key = patient_map.get(p_alias, -1)
            d_key = grp["date_key"].iloc[0] if "date_key" in grp else 20260101
            starts = pd.concat([grp[c] for c in ["checkin_at", "arrival_time"] if c in grp], ignore_index=True).dropna()
            ends = pd.concat([grp[c] for c in ["completed_at", "service_end"] if c in grp], ignore_index=True).dropna()
            start_ts = starts.min() if not starts.empty else None
            end_ts = ends.max() if not ends.empty else None
            duration = (end_ts - start_ts).total_seconds() / 60 if start_ts is not None and end_ts is not None else np.nan
            steps = set(grp.get("task_type", pd.Series(dtype=str)).dropna())
            
            journey_rows.append({
                "journey_key": journey_idx,
                "journey_id": j_id,
                "patient_key": p_key,
                "date_key": d_key,
                "severity_score": grp["severity_score"].iloc[0] if "severity_score" in grp and grp["severity_score"].notna().any() else 3,
                "intake_source": grp["intake_source"].iloc[0] if "intake_source" in grp and grp["intake_source"].notna().any() else "PATIENT_SELF",
                "total_tasks": len(grp),
                "completed_tasks": int(grp["status"].eq("COMPLETED").sum()) if "status" in grp else len(grp),
                "journey_duration_minutes": duration,
                "total_operational_wait_minutes": float(grp["operational_wait_minutes"].sum()) if "operational_wait_minutes" in grp else 0.0,
                "total_service_minutes": float(grp["service_duration_minutes"].sum()) if "service_duration_minutes" in grp else 0.0,
                "has_a_b_return": int({"INITIAL_CONSULT", "DIAGNOSTIC_SERVICE", "RETURN_REVIEW"}.issubset(steps)),
                "sla_breached_flag": int(grp.get("sla_breach", False).any()),
            })
            journey_idx += 1
            
    fact_journey = pd.DataFrame(journey_rows) if journey_rows else pd.DataFrame()

    return {
        "fact_task_execution": fact_task_clean,
        "fact_patient_journey": fact_journey,
        "dim_patient": dim_patient,
        "dim_doctor": doctors,
        "dim_clinic_room": rooms,
        "dim_specialty": specialties,
        "dim_date": dim_date,
        "dim_time_slot": dim_time_slot,
    }


def export_datamart(prefer_live: bool = True) -> dict[str, Any]:
    """Generates Gold layer Star Schema files in Parquet and CSV formats."""
    DATAMART_DIR.mkdir(parents=True, exist_ok=True)
    silver_tasks, source = load_tasks(prefer_live=prefer_live)
    schema_tables = build_star_schema(silver_tasks)
    
    manifest_tables: dict[str, dict[str, Any]] = {}
    
    for table_name, df in schema_tables.items():
        csv_path = DATAMART_DIR / f"{table_name}.csv"
        df.to_csv(csv_path, index=False)
        
        parquet_path = DATAMART_DIR / f"{table_name}.parquet"
        parquet_saved = False
        try:
            df.to_parquet(parquet_path, index=False, engine="auto")
            parquet_saved = True
        except Exception:
            pass
            
        manifest_tables[table_name] = {
            "rows": len(df),
            "columns": len(df.columns),
            "csv_path": str(csv_path),
            "parquet_path": str(parquet_path) if parquet_saved else None,
        }
        
    summary = {
        "status": "SUCCESS",
        "timestamp": datetime.now().isoformat(),
        "source": source,
        "datamart_dir": str(DATAMART_DIR),
        "tables": manifest_tables,
    }
    
    (DATAMART_DIR / "datamart_manifest.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="MedFlow Gold Layer Star Schema Data Mart Generator")
    parser.add_argument("--demo", action="store_true", help="Use synthetic/seeded CSV source")
    args = parser.parse_args()
    summary = export_datamart(prefer_live=not args.demo)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
