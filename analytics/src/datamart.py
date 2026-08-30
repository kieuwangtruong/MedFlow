from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from .extract import load_tasks
from .metrics import load_config, prepare_tasks

ANALYTICS_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ANALYTICS_ROOT / "outputs"
DATAMART_DIR = OUTPUT_DIR / "datamart"


def build_date_dimension(start_date: str = "2026-01-01", end_date: str = "2026-12-31") -> pd.DataFrame:
    """Generate standardized enterprise Date Dimension."""
    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    df = pd.DataFrame({"full_date": dates})
    df["date_key"] = df["full_date"].dt.strftime("%Y%m%d").astype(int)
    df["full_date_str"] = df["full_date"].dt.strftime("%Y-%m-%d")
    df["year"] = df["full_date"].dt.year
    df["quarter"] = "Q" + df["full_date"].dt.quarter.astype(str)
    df["month"] = df["full_date"].dt.month
    df["month_name"] = df["full_date"].dt.month_name()
    df["day_of_month"] = df["full_date"].dt.day
    df["day_of_week"] = df["full_date"].dt.dayofweek  # 0=Monday, 6=Sunday
    df["day_name"] = df["full_date"].dt.day_name()
    df["is_weekend"] = df["day_of_week"].isin([5, 6])
    return df


def build_time_slot_dimension() -> pd.DataFrame:
    """Generate 48 thirty-minute slot time dimension."""
    slots = []
    for index in range(48):
        total_minutes = index * 30
        start_hour, start_min = divmod(total_minutes, 60)
        end_hour, end_min = divmod(total_minutes + 30, 60)
        start_str = f"{start_hour:02d}:{start_min:02d}"
        end_str = f"{end_hour:02d}:{end_min:02d}"
        
        if 7 <= start_hour < 12:
            shift = "MORNING"
        elif 12 <= start_hour < 17:
            shift = "AFTERNOON"
        elif 17 <= start_hour < 22:
            shift = "EVENING"
        else:
            shift = "NIGHT"
            
        slots.append({
            "time_slot_key": index,
            "slot_start_time": start_str,
            "slot_end_time": end_str,
            "slot_label": f"{start_str} - {end_str}",
            "shift_period": shift,
        })
    return pd.DataFrame(slots)


def build_star_schema(tasks_raw: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Transform Silver dataset into dimensional Star Schema tables."""
    tasks = prepare_tasks(tasks_raw)
    config = load_config()
    sla_map = config.get("sla_minutes", {"EMERGENCY": 5, "URGENT": 15, "NORMAL": 30, "NON_URGENT": 60})

    # --- 1. Dimension: dim_patient ---
    patient_aliases = tasks["patient_alias"].dropna().unique() if "patient_alias" in tasks else []
    dim_patient = pd.DataFrame({
        "patient_key": patient_aliases,
        "patient_alias": patient_aliases,
        "anonymization_method": "SHA-256 (Truncated)",
    })
    if dim_patient.empty:
        dim_patient = pd.DataFrame([{"patient_key": "P-UNKNOWN", "patient_alias": "P-UNKNOWN", "anonymization_method": "None"}])

    # --- 2. Dimension: dim_doctor ---
    doctor_rows = []
    if "doctor_id" in tasks and tasks["doctor_id"].notna().any():
        for doc_id, grp in tasks.groupby("doctor_id"):
            doc_name = grp["doctor_name"].dropna().iloc[0] if "doctor_name" in grp and grp["doctor_name"].notna().any() else f"Bác sĩ {doc_id}"
            doctor_rows.append({"doctor_key": str(doc_id), "doctor_id": str(doc_id), "doctor_name": doc_name, "role": "DOCTOR"})
    else:
        doctor_rows = [{"doctor_key": "D-UNKNOWN", "doctor_id": "D-UNKNOWN", "doctor_name": "BS. Trực lâm sàng", "role": "DOCTOR"}]
    dim_doctor = pd.DataFrame(doctor_rows)

    # --- 3. Dimension: dim_clinic_room ---
    room_col = tasks.get("room_name", tasks.get("queue_id", pd.Series("PHONG-01", index=tasks.index)))
    room_keys = tasks.get("room_id", tasks.get("queue_id", room_col)).fillna("ROOM-DEFAULT").astype(str).unique()
    room_rows = []
    for r_key in room_keys:
        sub = tasks[tasks.get("room_id", tasks.get("queue_id", room_col)).astype(str) == r_key]
        r_name = sub["room_name"].dropna().iloc[0] if "room_name" in sub and sub["room_name"].notna().any() else r_key
        r_dept = sub["department_name"].dropna().iloc[0] if "department_name" in sub and sub["department_name"].notna().any() else "Khoa Khám bệnh"
        room_rows.append({
            "room_key": r_key,
            "room_name": r_name,
            "department_name": r_dept,
            "is_active": True,
        })
    dim_clinic_room = pd.DataFrame(room_rows)

    # --- 4. Dimension: dim_specialty ---
    specialty_rows = []
    if "specialty_name" in tasks and tasks["specialty_name"].notna().any():
        for s_name, grp in tasks.groupby("specialty_name"):
            s_key = grp["specialty_id"].dropna().iloc[0] if "specialty_id" in grp and grp["specialty_id"].notna().any() else f"SPEC-{s_name}"
            s_dept = grp["department_name"].dropna().iloc[0] if "department_name" in grp and grp["department_name"].notna().any() else "Khoa Khám bệnh"
            specialty_rows.append({"specialty_key": str(s_key), "specialty_name": str(s_name), "department_name": s_dept})
    else:
        specialty_rows = [{"specialty_key": "SPEC-DEFAULT", "specialty_name": "Khám Nội tổng quát", "department_name": "Khoa Khám bệnh"}]
    dim_specialty = pd.DataFrame(specialty_rows)

    # --- 5 & 6. Dimensions: dim_date and dim_time_slot ---
    dim_date = build_date_dimension()
    dim_time_slot = build_time_slot_dimension()

    # --- 7. Fact Table: fact_task_execution ---
    fact_task_list = []
    for idx, row in tasks.iterrows():
        # Compute date_key and time_slot_key
        ref_time = row.get("service_start")
        if pd.isna(ref_time) or ref_time is None:
            ref_time = row.get("arrival_time")
        if pd.isna(ref_time) or ref_time is None:
            ref_time = row.get("checkin_at")
        if pd.isna(ref_time) or ref_time is None:
            ref_time = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh")

        if hasattr(ref_time, "tz_convert"):
            local_time = ref_time.tz_convert("Asia/Ho_Chi_Minh")
        else:
            local_time = pd.to_datetime(ref_time)

        date_key = int(local_time.strftime("%Y%m%d"))
        time_slot_key = local_time.hour * 2 + (1 if local_time.minute >= 30 else 0)

        priority = row.get("clinical_priority", "NORMAL")
        sla_target = sla_map.get(priority, 30.0)
        op_wait = float(row.get("operational_wait_minutes", np.nan))
        is_sla_breach = bool(op_wait > sla_target) if pd.notna(op_wait) else False

        r_key = str(row.get("room_id") or row.get("queue_id") or "ROOM-DEFAULT")
        doc_key = str(row.get("doctor_id") or "D-UNKNOWN")
        spec_key = str(row.get("specialty_id") or "SPEC-DEFAULT")

        fact_task_list.append({
            "task_key": str(row.get("task_id", f"t-{idx}")),
            "journey_key": str(row.get("journey_id", f"j-{idx}")),
            "patient_key": str(row.get("patient_alias", "P-UNKNOWN")),
            "doctor_key": doc_key,
            "room_key": r_key,
            "specialty_key": spec_key,
            "date_key": date_key,
            "time_slot_key": time_slot_key,
            "task_type": str(row.get("task_type", "INITIAL_CONSULT")),
            "service_type": str(row.get("service_type", "CLINICAL_CONSULT")),
            "clinical_priority": str(priority),
            "status": str(row.get("status", "COMPLETED")),
            "operational_wait_minutes": op_wait,
            "physical_wait_minutes": float(row.get("physical_wait_minutes", np.nan)),
            "service_duration_minutes": float(row.get("service_duration_minutes", np.nan)),
            "result_turnaround_minutes": float(row.get("result_turnaround_minutes", np.nan)),
            "sla_target_minutes": sla_target,
            "is_sla_breach": is_sla_breach,
            "queue_length_at_arrival": int(row.get("queue_length", 0)) if pd.notna(row.get("queue_length")) else 0,
            "resource_failure": bool(row.get("resource_failure", False)),
            "emergency_insertion": bool(row.get("emergency_insertion", False)),
        })
    fact_task_execution = pd.DataFrame(fact_task_list)

    # --- 8. Fact Table: fact_patient_journey ---
    fact_journey_list = []
    if "journey_id" in tasks:
        for j_id, grp in tasks.groupby("journey_id"):
            first_task = grp.iloc[0]
            checkin = grp["checkin_at"].dropna() if "checkin_at" in grp else pd.Series(dtype=object)
            first_arrival = grp["arrival_time"].dropna() if "arrival_time" in grp else pd.Series(dtype=object)
            start_point = checkin.min() if not checkin.empty else (first_arrival.min() if not first_arrival.empty else pd.Timestamp.now(tz="Asia/Ho_Chi_Minh"))
            
            end_candidates = [grp[c].dropna() for c in ["completed_at", "service_end"] if c in grp]
            ends = pd.concat(end_candidates) if end_candidates else pd.Series(dtype=object)
            end_point = ends.max() if not ends.empty else start_point

            if hasattr(start_point, "tz_convert"):
                local_start = start_point.tz_convert("Asia/Ho_Chi_Minh")
            else:
                local_start = pd.to_datetime(start_point)

            date_key = int(local_start.strftime("%Y%m%d"))
            time_slot_key = local_start.hour * 2 + (1 if local_start.minute >= 30 else 0)

            steps = set(grp.get("task_type", pd.Series(dtype=str)).dropna())
            has_a_b_return = {"INITIAL_CONSULT", "DIAGNOSTIC_SERVICE", "RETURN_REVIEW"}.issubset(steps)

            duration_min = (end_point - start_point).total_seconds() / 60 if pd.notna(start_point) and pd.notna(end_point) else np.nan
            total_wait = grp["operational_wait_minutes"].sum(skipna=True)
            total_service = grp["service_duration_minutes"].sum(skipna=True)
            sla_breached = bool(grp["sla_breach"].any()) if "sla_breach" in grp else False

            fact_journey_list.append({
                "journey_key": str(j_id),
                "patient_key": str(first_task.get("patient_alias", "P-UNKNOWN")),
                "date_key": date_key,
                "time_slot_key": time_slot_key,
                "intake_source": str(first_task.get("intake_source", "PATIENT_SELF")),
                "severity_score": int(first_task.get("severity_score", 3)) if pd.notna(first_task.get("severity_score")) else 3,
                "total_tasks": len(grp),
                "completed_tasks": int(grp.get("status", pd.Series(index=grp.index)).eq("COMPLETED").sum()),
                "has_a_b_return": has_a_b_return,
                "total_wait_minutes": float(total_wait),
                "total_service_minutes": float(total_service),
                "journey_duration_minutes": float(duration_min),
                "is_sla_breached": sla_breached,
            })
    fact_patient_journey = pd.DataFrame(fact_journey_list)

    return {
        "fact_patient_journey": fact_patient_journey,
        "fact_task_execution": fact_task_execution,
        "dim_patient": dim_patient,
        "dim_doctor": dim_doctor,
        "dim_clinic_room": dim_clinic_room,
        "dim_specialty": dim_specialty,
        "dim_date": dim_date,
        "dim_time_slot": dim_time_slot,
    }


def publish_datamart(prefer_live: bool = True) -> dict:
    """Build and save Star Schema Data Mart in both Parquet and CSV formats."""
    DATAMART_DIR.mkdir(parents=True, exist_ok=True)
    raw_tasks, source = load_tasks(prefer_live=prefer_live)
    tables = build_star_schema(raw_tasks)

    results = {}
    for table_name, df in tables.items():
        csv_path = DATAMART_DIR / f"{table_name}.csv"
        parquet_path = DATAMART_DIR / f"{table_name}.parquet"
        df.to_csv(csv_path, index=False)
        try:
            df.to_parquet(parquet_path, index=False)
        except Exception:
            pass
        results[table_name] = {"rows": len(df), "columns": len(df.columns), "csv": str(csv_path), "parquet": str(parquet_path)}

    summary = {
        "datamart_status": "PUBLISHED",
        "source": source,
        "tables_count": len(tables),
        "tables": results,
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish Gold Star Schema Data Mart")
    parser.add_argument("--demo", action="store_true", help="Use seeded demo dataset")
    args = parser.parse_args()
    summary = publish_datamart(prefer_live=not args.demo)
    print("=== Star Schema Data Mart Successfully Published ===")
    for t_name, info in summary["tables"].items():
        print(f" - {t_name:22s}: {info['rows']:5d} rows, {info['columns']:2d} cols -> {info['parquet']}")


if __name__ == "__main__":
    main()
