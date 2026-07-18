import json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
import joblib,pytest
from fastapi.testclient import TestClient
import app.main as main
from app.domain.models import *
from app.ml.predictor import DurationPredictor
from app.queue_engine.engine import QueueEngine
from app.services.events import apply_event
from app.storage.memory import Store

TZ=ZoneInfo("Asia/Ho_Chi_Minh");NOW=datetime.now(TZ)
def event(event_id="e1",event_type="PATIENT_CHECKED_IN",task_id="t1",queue_id="ROOM-A",version=None,task_type="INITIAL_CONSULT"):
    return Event(event_id=event_id,event_time=NOW,journey_id="j1",task_id=task_id,patient_token="P1",queue_id=queue_id,event_type=event_type,task_type=task_type,clinical_priority="NORMAL",resource_id="r1",based_on_estimate_version=version,actor_id="router",correlation_id="c1")
@pytest.fixture
def persistent_store(tmp_path,monkeypatch):
    s=Store(f"sqlite:///{(tmp_path/'state.db').as_posix()}");monkeypatch.setattr(main,"store",s);main.estimate_cache.clear();return s
def add_rooms(s,*ids):
    for room in ids:s.resources[f"r-{room}"]=Resource(resource_id=f"r-{room}",queue_id=room)

def test_restart_recovers_state_and_idempotency(tmp_path):
    url=f"sqlite:///{(tmp_path/'restart.db').as_posix()}";first=Store(url);assert apply_event(first,event())
    second=Store(url);assert second.version==1 and "t1" in second.tasks and "e1" in second.events;assert apply_event(second,event()) is False and second.version==1

def test_assignment_audit_is_persistent(persistent_store):
    add_rooms(persistent_store,"ROOM-A");e=event("assign","TASK_ASSIGNED_TO_QUEUE",version=0);assert apply_event(persistent_store,e)
    audits=persistent_store.list_audits();assert audits[-1].action=="ROOM_ASSIGNED" and audits[-1].actor_id=="router"

def test_room_options_three_rooms_and_dry_run(persistent_store):
    add_rooms(persistent_store,"ROOM-A","ROOM-B","ROOM-C");before=persistent_store.version
    body={"request_id":"REQ-1","patient_token":"P","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":NOW.isoformat(),"candidate_room_ids":["ROOM-A","ROOM-B","ROOM-C"],"dry_run":True}
    data=TestClient(main.app).post("/api/v1/estimates/room-options",json=body).json();assert len(data["options"])==3 and "selected_room" not in data and persistent_store.version==before

def test_assignment_impact_detects_affected_patients(persistent_store):
    add_rooms(persistent_store,"ROOM-A");persistent_store.tasks["waiting"]=Task(task_id="waiting",journey_id="j",patient_token="W",queue_id="ROOM-A",task_type="INITIAL_CONSULT",clinical_priority="NORMAL",readiness_status="READY",ready_at=NOW,predicted_minutes=10)
    body={"patient_token":"P","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"URGENT","ready_at":NOW.isoformat(),"room_id":"ROOM-A","predicted_minutes":12,"dry_run":True}
    impact=TestClient(main.app).post("/api/v1/estimates/assignment-impact",json=body).json()["assignment_impact"];assert impact["affected_patients"]==1 and impact["max_added_wait_minutes"]==12

def test_old_estimate_version_requires_requote(persistent_store):
    add_rooms(persistent_store,"ROOM-A");apply_event(persistent_store,event("seed"));payload=event("assign","TASK_ASSIGNED_TO_QUEUE","new","ROOM-A",0).model_dump(mode="json")
    response=TestClient(main.app).post("/api/v1/events",json=payload);assert response.status_code==409 and response.json()["detail"]["status"]=="REQUOTE_REQUIRED";assert persistent_store.list_audits()[-1].action=="ASSIGNMENT_REJECTED"

def test_routing_agent_integration_flow(persistent_store):
    add_rooms(persistent_store,"ROOM-A","ROOM-B");client=TestClient(main.app);body={"request_id":"REQ-2","patient_token":"PX","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":NOW.isoformat(),"candidate_room_ids":["ROOM-A","ROOM-B"],"dry_run":True}
    quote=client.post("/api/v1/estimates/room-options",json=body).json();version=quote["options"][0]["estimate_version"]
    assigned=event("route-assign","TASK_ASSIGNED_TO_QUEUE","route-task","ROOM-B",version).model_dump(mode="json");assigned["patient_token"]="PX"
    response=client.post("/api/v1/events",json=assigned);assert response.status_code==200 and persistent_store.tasks["route-task"].queue_id=="ROOM-B" and response.json()["estimate_version"]==version+1

def test_wait_time_endpoints_are_public(persistent_store):
    client=TestClient(main.app)
    assert client.get("/api/v1/rooms/status").status_code==200
    assert client.post("/api/v1/simulations/scenario",json={"scenario_type":"NO_SHOW","queue_id":"Q"}).status_code==200

def test_result_pending_is_future_workload():
    engine=QueueEngine();resource=[Resource(resource_id="r",queue_id="Q")];target=Task(task_id="target",journey_id="j",patient_token="P",queue_id="Q",task_type="INITIAL_CONSULT",readiness_status="READY",ready_at=NOW+timedelta(minutes=20),predicted_minutes=10,created_seq=2)
    pending=Task(task_id="pending",journey_id="j2",patient_token="R",queue_id="Q",task_type="DIAGNOSTIC_SERVICE",readiness_status="RESULT_PENDING",ready_at=NOW,predicted_minutes=5,estimated_result_ready_at=NOW+timedelta(minutes=5),estimated_return_arrived_at=NOW+timedelta(minutes=5),created_seq=1)
    without=engine.monte_carlo(target,[target],resource,NOW,runs=100,seed=7);with_future=engine.monte_carlo(target,[target,pending],resource,NOW,runs=100,seed=7);assert with_future["ewt_p80_minutes"]>=without["ewt_p80_minutes"]

def test_journey_actual_timestamps_are_persisted(persistent_store):
    apply_event(persistent_store,event("review-order","SERVICE_ORDERED","review","ROOM-A",task_type="RETURN_REVIEW"));r=event("result","RESULT_READY","review","ROOM-A",task_type="RETURN_REVIEW");r.event_time=NOW+timedelta(minutes=1);apply_event(persistent_store,r);a=event("return","RETURN_ARRIVED","review","ROOM-A",task_type="RETURN_REVIEW");a.event_time=NOW+timedelta(minutes=2);apply_event(persistent_store,a)
    j=persistent_store.journeys["j1"];assert j.actual_result_ready_at and j.actual_return_arrived_at and j.ready_for_review_at==j.actual_return_arrived_at

def test_incompatible_model_schema_falls_back(tmp_path,monkeypatch):
    joblib.dump({},tmp_path/"quantile_models.joblib");(tmp_path/"baseline.json").write_text("{}")
    (tmp_path/"feature_schema.json").write_text(json.dumps({"features":[]}));(tmp_path/"training_metadata.json").write_text(json.dumps({"feature_schema_version":"999","production_policy":"model"}));monkeypatch.setenv("MODEL_SCHEMA_VERSION","1")
    p=DurationPredictor(tmp_path);assert p.using_fallback and "INCOMPATIBLE_FEATURE_SCHEMA" in p.load_error

def test_room_status_and_queue_summary(persistent_store):
    add_rooms(persistent_store,"ROOM-A");client=TestClient(main.app);assert client.get("/api/v1/rooms/status").status_code==200;assert client.get("/api/v1/queues/ROOM-A/summary").json()["room_id"]=="ROOM-A"
