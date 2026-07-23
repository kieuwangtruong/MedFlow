import pandas as pd

from analytics.src.metrics import journey_summary, kpis, prepare_tasks


def sample_tasks():
    return pd.DataFrame([
        {"task_id":"t1","journey_id":"j1","task_type":"INITIAL_CONSULT","status":"COMPLETED","clinical_priority":"NORMAL","arrival_time":"2026-01-01T00:00:00Z","ready_at":"2026-01-01T00:05:00Z","service_start":"2026-01-01T00:15:00Z","service_end":"2026-01-01T00:25:00Z","completed_at":"2026-01-01T00:25:00Z","checkin_at":"2026-01-01T00:00:00Z"},
        {"task_id":"t2","journey_id":"j1","task_type":"DIAGNOSTIC_SERVICE","status":"COMPLETED","clinical_priority":"NORMAL","arrival_time":"2026-01-01T00:30:00Z","ready_at":"2026-01-01T00:30:00Z","service_start":"2026-01-01T00:40:00Z","service_end":"2026-01-01T00:50:00Z","completed_at":"2026-01-01T00:50:00Z","checkin_at":"2026-01-01T00:00:00Z"},
        {"task_id":"t3","journey_id":"j1","task_type":"RETURN_REVIEW","status":"COMPLETED","clinical_priority":"NORMAL","arrival_time":"2026-01-01T01:00:00Z","ready_at":"2026-01-01T01:00:00Z","service_start":"2026-01-01T01:10:00Z","service_end":"2026-01-01T01:20:00Z","completed_at":"2026-01-01T01:20:00Z","checkin_at":"2026-01-01T00:00:00Z"},
    ])


def test_operational_wait_uses_later_ready_boundary():
    frame = prepare_tasks(sample_tasks())
    assert frame.loc[0, "operational_wait_minutes"] == 10


def test_journey_a_b_return_and_duration():
    journey = journey_summary(sample_tasks()).iloc[0]
    assert bool(journey["has_a_b_return"])
    assert journey["journey_completion_minutes"] == 80


def test_kpis_are_consistent():
    result = kpis(sample_tasks())
    assert result["tasks"] == 3
    assert result["median_wait"] == 10
    assert result["sla_breach_rate"] == 0

