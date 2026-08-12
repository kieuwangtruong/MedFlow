from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.domain.models import Event, Resource
from app.services.events import RequoteRequired, apply_event
from app.storage.memory import Store


TZ = ZoneInfo("Asia/Ho_Chi_Minh")
NOW = datetime(2026, 8, 11, 9, 0, tzinfo=TZ)


def assignment(event_id: str, room: str, version: int) -> Event:
    return Event(
        event_id=event_id,
        event_time=NOW,
        journey_id="journey-concurrent",
        task_id="task-concurrent",
        patient_token="PATIENT-ALIAS",
        queue_id=room,
        event_type="TASK_ASSIGNED_TO_QUEUE",
        task_type="INITIAL_CONSULT",
        clinical_priority="NORMAL",
        based_on_estimate_version=version,
        actor_id="routing-agent",
        actor_type="SERVICE",
    )


@pytest.fixture
def state(tmp_path, monkeypatch):
    store = Store(f"sqlite:///{(tmp_path / 'hardening.db').as_posix()}")
    store.resources["resource-a"] = Resource(resource_id="resource-a", queue_id="ROOM-A")
    store.resources["resource-b"] = Resource(resource_id="resource-b", queue_id="ROOM-B")
    monkeypatch.setattr(main, "store", store)
    main.estimate_cache.clear()
    return store


def test_room_options_returns_quote_metadata_and_is_state_free(state):
    client = TestClient(main.app)
    before = (state.version, dict(state.queue_versions), len(state.events), len(state.tasks), len(state.list_audits()))
    response = client.post("/api/v1/estimates/room-options", json={
        "request_id": "quote-1",
        "patient_token": "PATIENT-ALIAS",
        "task_type": "INITIAL_CONSULT",
        "service_code": "CLINICAL_CONSULT",
        "clinical_priority": "NORMAL",
        "ready_at": NOW.isoformat(),
        "candidate_room_ids": ["ROOM-A", "ROOM-B"],
        "dry_run": True,
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["dry_run"] is True
    assert payload["estimate_version"] == 0
    assert payload["generated_at"] < payload["valid_until"]
    assert payload["estimate_versions"] == {"ROOM-A": 0, "ROOM-B": 0}
    assert "selected_room" not in payload
    assert before == (state.version, dict(state.queue_versions), len(state.events), len(state.tasks), len(state.list_audits()))


@pytest.mark.parametrize("path,body", [
    ("/api/v1/estimates/room-options", {
        "request_id": "not-dry",
        "patient_token": "P",
        "task_type": "INITIAL_CONSULT",
        "service_code": "CLINICAL_CONSULT",
        "clinical_priority": "NORMAL",
        "ready_at": NOW.isoformat(),
        "candidate_room_ids": ["ROOM-A"],
        "dry_run": False,
    }),
    ("/api/v1/estimates/assignment-impact", {
        "patient_token": "P",
        "task_type": "INITIAL_CONSULT",
        "service_code": "CLINICAL_CONSULT",
        "clinical_priority": "NORMAL",
        "ready_at": NOW.isoformat(),
        "room_id": "ROOM-A",
        "dry_run": False,
    }),
])
def test_dry_run_endpoints_reject_mutating_mode(state, path, body):
    assert TestClient(main.app).post(path, json=body).status_code == 422
    assert state.version == 0 and not state.events and not state.tasks


def test_requote_contract_has_all_required_fields(state):
    assert apply_event(state, assignment("accepted", "ROOM-A", 0))
    response = TestClient(main.app).post(
        "/api/v1/events",
        json=assignment("stale", "ROOM-B", 0).model_dump(mode="json"),
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail == {
        "status": "REQUOTE_REQUIRED",
        "current_estimate_version": 1,
        "based_on_estimate_version": 0,
        "reason_code": "STATE_VERSION_CHANGED",
        "next_action": "CALL_ROOM_OPTIONS_AGAIN",
        "message": "REQUOTE_REQUIRED: current estimate_version is 1",
    }
    assert state.list_audits()[-1].action == "ASSIGNMENT_REJECTED"


def test_concurrent_assignment_accepts_exactly_one_event(state):
    events = [assignment("concurrent-a", "ROOM-A", 0), assignment("concurrent-b", "ROOM-B", 0)]

    def submit(event):
        try:
            return apply_event(state, event)
        except RequoteRequired:
            return "REQUOTE_REQUIRED"

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, events))
    assert results.count(True) == 1
    assert results.count("REQUOTE_REQUIRED") == 1
    assert state.version == 1
    assert len(state.events) == 1
    assert state.tasks["task-concurrent"].queue_id in {"ROOM-A", "ROOM-B"}


def test_restart_preserves_queue_versions_and_estimate(state):
    apply_event(state, assignment("restart-assignment", "ROOM-A", 0))
    first = main.estimate_task(state.tasks["task-concurrent"], NOW + timedelta(minutes=1)).model_dump(mode="json")
    restored = Store(state.database_url)
    second_task = restored.tasks["task-concurrent"]
    original_store = main.store
    try:
        main.store = restored
        main.estimate_cache.clear()
        second = main.estimate_task(second_task, NOW + timedelta(minutes=1)).model_dump(mode="json")
    finally:
        main.store = original_store
        main.estimate_cache.clear()
    assert restored.queue_versions == {"ROOM-A": 1}
    assert restored.version == 1
    assert first["estimate"] == second["estimate"]
    assert first["estimate_version"] == second["estimate_version"] == 1
    assert apply_event(restored, assignment("restart-assignment", "ROOM-A", 0)) is False
    assert restored.version == 1


def test_health_contracts_are_available(state):
    client = TestClient(main.app)
    assert client.get("/health/live").status_code == 200
    ready = client.get("/health/ready")
    assert ready.status_code == 200 and ready.json()["queue_engine"] == "initialized"
    version = client.get("/health/version")
    assert version.status_code == 200
    assert version.json()["state_schema_version"] == "3"
    assert version.json()["clinically_validated"] is False


def test_verified_principal_controls_audit_actor_and_override_reason(state):
    client = TestClient(main.app)
    created = assignment("override-base", "ROOM-A", 0).model_dump(mode="json")
    created["actor_id"] = "untrusted-patient-value"
    assert client.post("/api/v1/events", json=created).status_code == 200

    override = {
        **created,
        "event_id": "override-audit",
        "event_type": "OVERRIDE_RECORDED",
        "based_on_estimate_version": None,
        "reason_code": "CLINICIAN_SAFETY_DECISION",
        "metadata": {"override_type": "ROOM_ASSIGNMENT"},
    }
    assert client.post("/api/v1/events", json=override).status_code == 200
    audit = state.list_audits()[-1]
    assert audit.action == "OVERRIDE_RECORDED"
    assert audit.actor_id == "development"
    assert audit.actor_type == "SERVICE"
    assert audit.reason_code == "CLINICIAN_SAFETY_DECISION"
    assert "untrusted-patient-value" not in (audit.new_value or "")
