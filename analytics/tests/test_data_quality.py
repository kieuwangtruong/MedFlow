import pandas as pd

from analytics.src.data_quality import profile_tasks


def valid_row(**updates):
    row = {
        "task_id": "t1", "journey_id": "j1", "depends_on_task_id": None,
        "task_type": "INITIAL_CONSULT", "service_type": "CLINICAL_CONSULT",
        "clinical_priority": "NORMAL", "readiness_status": "COMPLETED",
        "queue_id": "ROOM-A", "doctor_id": "D1", "device_id": None,
        "arrival_time": "2026-08-11T09:00:00Z", "ready_at": "2026-08-11T09:00:00Z",
        "service_start": "2026-08-11T09:10:00Z", "service_end": "2026-08-11T09:20:00Z",
        "completed_at": "2026-08-11T09:20:00Z", "patient_alias": "P-0123456789ab",
    }
    row.update(updates)
    return row


def failures(frame):
    checks, _ = profile_tasks(frame)
    return dict(zip(checks["check"], checks["failures"]))


def test_extended_quality_contract_passes_valid_extract():
    result = failures(pd.DataFrame([valid_row()]))
    assert result["missing ready_at"] == 0
    assert result["invalid readiness_status"] == 0
    assert result["service without resource reference"] == 0
    assert result["cyclic journey dependency"] == 0
    assert result["invalid patient anonymization"] == 0


def test_extended_quality_contract_detects_high_risk_records():
    frame = pd.DataFrame([
        valid_row(task_id="t1", depends_on_task_id="t2", patient_alias="RAW-TOKEN"),
        valid_row(task_id="t2", depends_on_task_id="t1", readiness_status="BROKEN", doctor_id=None),
    ])
    result = failures(frame)
    assert result["cyclic journey dependency"] == 2
    assert result["invalid readiness_status"] == 1
    assert result["service without resource reference"] == 1
    assert result["invalid patient anonymization"] == 1


def test_raw_patient_token_is_rejected_for_published_output():
    frame = pd.DataFrame([valid_row(patient_token="P000001")]).drop(columns=["patient_alias"])
    assert failures(frame)["raw patient_token exposed in analytics output"] == 1
