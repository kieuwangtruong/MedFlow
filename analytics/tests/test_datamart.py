import pandas as pd
import pytest

from analytics.src.datamart import build_date_dimension, build_star_schema, build_time_slot_dimension


def sample_silver_tasks():
    return pd.DataFrame([
        {
            "task_id": "t-001",
            "journey_id": "j-001",
            "patient_alias": "P-0123456789",
            "doctor_id": "D1",
            "doctor_name": "BS. Nguyễn Văn Nam",
            "room_id": "ROOM-CARD-201",
            "room_name": "Phòng khám Tim mạch 201",
            "specialty_id": "SPEC-CARD-CONSULT",
            "specialty_name": "Khám Tim mạch",
            "department_name": "Khoa Tim mạch",
            "task_type": "INITIAL_CONSULT",
            "service_type": "CLINICAL_CONSULT",
            "clinical_priority": "NORMAL",
            "status": "COMPLETED",
            "arrival_time": "2026-06-15T08:00:00Z",
            "ready_at": "2026-06-15T08:05:00Z",
            "service_start": "2026-06-15T08:15:00Z",
            "service_end": "2026-06-15T08:30:00Z",
            "completed_at": "2026-06-15T08:30:00Z",
            "checkin_at": "2026-06-15T07:55:00Z",
            "queue_length": 3,
        }
    ])


def test_date_and_time_slot_dimensions():
    dim_date = build_date_dimension("2026-01-01", "2026-01-10")
    assert len(dim_date) == 10
    assert "date_key" in dim_date.columns
    assert "is_weekend" in dim_date.columns

    dim_slots = build_time_slot_dimension()
    assert len(dim_slots) == 48
    assert set(dim_slots["shift_period"].unique()).issubset({"MORNING", "AFTERNOON", "EVENING", "NIGHT"})


def test_star_schema_tables_generation():
    raw = sample_silver_tasks()
    tables = build_star_schema(raw)
    
    assert "fact_task_execution" in tables
    assert "fact_patient_journey" in tables
    assert "dim_patient" in tables
    assert "dim_doctor" in tables
    assert "dim_clinic_room" in tables
    assert "dim_specialty" in tables
    assert "dim_date" in tables
    assert "dim_time_slot" in tables

    fact_tasks = tables["fact_task_execution"]
    assert len(fact_tasks) == 1
    assert fact_tasks.loc[0, "task_key"] == "t-001"
    assert fact_tasks.loc[0, "operational_wait_minutes"] == 10.0
    assert fact_tasks.loc[0, "is_sla_breach"] == False

    fact_journeys = tables["fact_patient_journey"]
    assert len(fact_journeys) == 1
    assert fact_journeys.loc[0, "journey_key"] == "j-001"
    assert fact_journeys.loc[0, "completed_tasks"] == 1
