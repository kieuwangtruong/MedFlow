from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from app.main import app
from app.storage.memory import store
from app.domain.models import *
from app.queue_engine.engine import QueueEngine
from app.services.events import apply_event
from app.services.journey import estimate_journey
from app.ml.predictor import DurationPredictor
TZ=ZoneInfo("Asia/Ho_Chi_Minh");NOW=datetime.now(TZ)
def task(i,priority="NORMAL",status="READY",kind="INITIAL_CONSULT",mode="FAIR_QUEUE",ready=None):return Task(task_id=i,journey_id="j",patient_token=i,queue_id="Q",task_type=kind,clinical_priority=priority,readiness_status=status,scheduling_mode=mode,ready_at=ready or NOW,predicted_minutes=10,created_seq=int(i[-1]) if i[-1].isdigit() else 0)
def resources(n=1):return [Resource(resource_id=f"r{i}",queue_id="Q") for i in range(n)]
def test_normal_and_two_parallel_resources():
 e=QueueEngine();ts=[task("t1"),task("t2"),task("t3")];one=e.schedule(ts,resources(1),NOW);two=e.schedule(ts,resources(2),NOW);assert one["t3"]==20 and two["t3"]==10
def test_emergency_precedes_normal_and_urgent_safe_slot():
 e=QueueEngine();ordered=e.order([task("t1"),task("t2","EMERGENCY"),task("t3","URGENT",kind="RETURN_REVIEW",mode="ASAP")],NOW);assert [x.task_id for x in ordered]==["t2","t3","t1"]
def test_no_show_and_pending_do_not_occupy_queue():
 e=QueueEngine();assert [x.task_id for x in e.order([task("t1",status="NO_SHOW_HOLD"),task("t2",status="RESULT_PENDING"),task("t3")],NOW)]==["t3"]
def test_failed_resource_unavailable():assert QueueEngine().schedule([task("t1")],[Resource(resource_id="r",queue_id="Q",status="FAILED")],NOW)=={}
def test_scheduled_window_does_not_idle_doctor():
 late=task("t1",mode="SCHEDULED_WINDOW",ready=NOW+timedelta(hours=1));assert QueueEngine().order([late,task("t2")],NOW)[0].task_id=="t2"
def test_return_normal_only_delays_following_tasks():
 e=QueueEngine();before=e.schedule([task("t1"),task("t3")],resources(),NOW);after=e.schedule([task("t1"),task("t2",kind="RETURN_REVIEW"),task("t3")],resources(),NOW);assert before["t1"]==after["t1"] and after["t3"]-before["t3"]==10
def test_journey_a_b_return_a():
 r=estimate_journey(NOW,5,12,3,10,15,3,20,NOW+timedelta(minutes=70),5);assert r["ready_for_review"]==max(r["physical_return"],r["result_ready"]) and r["journey_completion"]>r["review_start"]
def test_duplicate_event_idempotent_and_api_schema():
 store.reset();e={"event_id":"e1","event_time":NOW.isoformat(),"journey_id":"j","task_id":"t1","patient_token":"P1","queue_id":"Q","event_type":"PATIENT_CHECKED_IN","task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL","resource_id":"r1","metadata":{}}
 c=TestClient(app);assert c.post("/api/v1/events",json=e).json()["accepted"];assert c.post("/api/v1/events",json=e).json()["duplicate"];assert len(store.tasks)==1;assert c.get("/api/v1/tasks/t1/estimate").status_code==200
def test_timestamp_without_timezone_rejected():
 bad={"event_id":"e","event_time":"2026-01-01T10:00:00","journey_id":"j","task_id":"t","patient_token":"P","queue_id":"Q","event_type":"PATIENT_CHECKED_IN","task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL"};assert TestClient(app).post("/api/v1/events",json=bad).status_code==422

def test_model_failure_uses_non_negative_baseline(tmp_path):
 p=DurationPredictor(tmp_path); assert p.using_fallback and p.predict_service_duration({"service_type":"XRAY"})=={"p50":8.0,"p80":10.0,"p90":12.0}

def test_resource_compatibility():
 t=task("t1");t.service_type="XRAY";rs=[Resource(resource_id="u",queue_id="Q",compatible_service_types={"ULTRASOUND"}),Resource(resource_id="x",queue_id="Q",compatible_service_types={"XRAY"})]
 assert QueueEngine().schedule([t],rs,NOW)["t1"]==0

def test_timestamp_ordering_rejected():
 store.reset();client=TestClient(app);base={"journey_id":"j","task_id":"t","patient_token":"P","queue_id":"Q","task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL"}
 assert client.post("/api/v1/events",json=base|{"event_id":"new","event_time":NOW.isoformat(),"event_type":"PATIENT_CHECKED_IN"}).status_code==200
 assert client.post("/api/v1/events",json=base|{"event_id":"old","event_time":(NOW-timedelta(minutes=1)).isoformat(),"event_type":"ARRIVED_QUEUE"}).status_code==409

def test_scenario_dry_run_never_mutates_state():
 store.reset();version=store.version;response=TestClient(app).post("/api/v1/simulations/scenario",json={"scenario_type":"EMERGENCY_INSERT","queue_id":"Q","dry_run":True})
 assert response.status_code==200 and store.version==version and not store.tasks

def test_resource_unavailable_schema():
 store.reset();apply_event(store,Event(event_id="e",event_time=NOW,journey_id="j",task_id="t",patient_token="P",queue_id="Q",event_type="PATIENT_CHECKED_IN",task_type="INITIAL_CONSULT",clinical_priority="NORMAL"))
 response=TestClient(app).get("/api/v1/tasks/t/estimate").json();assert response["estimate_status"]=="RESOURCE_UNAVAILABLE" and response["estimate"] is None

def test_full_journey_event_integration():
 store.reset();client=TestClient(app);base={"journey_id":"journey-e2e","patient_token":"TOKEN","clinical_priority":"NORMAL","resource_id":"r1","metadata":{}}
 events=[("a","INITIAL_CONSULT","PATIENT_CHECKED_IN"),("a","INITIAL_CONSULT","SERVICE_STARTED"),("a","INITIAL_CONSULT","SERVICE_COMPLETED"),("b","DIAGNOSTIC_SERVICE","SERVICE_ORDERED"),("b","DIAGNOSTIC_SERVICE","SERVICE_COMPLETED"),("review","RETURN_REVIEW","SERVICE_ORDERED"),("review","RETURN_REVIEW","RESULT_READY"),("review","RETURN_REVIEW","RETURN_ARRIVED")]
 for i,(task_id,task_type,event_type) in enumerate(events):
  payload=base|{"event_id":f"e{i}","event_time":(NOW+timedelta(minutes=i)).isoformat(),"task_id":task_id,"task_type":task_type,"event_type":event_type,"queue_id":"Q"}
  assert client.post("/api/v1/events",json=payload).status_code==200
 assert client.get("/api/v1/journeys/journey-e2e/estimate").status_code==200
