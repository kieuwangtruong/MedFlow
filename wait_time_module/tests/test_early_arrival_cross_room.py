import json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import app.main as main
from app.domain.models import *
from app.queue_engine.engine import QueueEngine
from app.services.events import apply_event
from app.storage.database import Base,MetaRecord,TaskRecord,make_engine
from app.storage.memory import Store
from app.storage.migrations import migrate

TZ=ZoneInfo("Asia/Ho_Chi_Minh")
def make_task(task_id="t",now=None,**updates):
    now=now or datetime.now(TZ);data={"task_id":task_id,"journey_id":"j","patient_token":task_id,"queue_id":"ROOM-A","task_type":"INITIAL_CONSULT","readiness_status":"READY","ready_at":now,"predicted_minutes":10,"created_seq":1};data.update(updates);return Task(**data)
def evt(event_id,event_type,task_id="t",when=None,metadata=None):
    return Event(event_id=event_id,event_time=when or datetime.now(TZ),journey_id="j",task_id=task_id,patient_token="P",queue_id="ROOM-A",event_type=event_type,task_type="INITIAL_CONSULT",clinical_priority="NORMAL",metadata=metadata or {},actor_id="test")
@pytest.fixture
def state(tmp_path,monkeypatch):
    s=Store(f"sqlite:///{(tmp_path/'early.db').as_posix()}");monkeypatch.setattr(main,"store",s);main.estimate_cache.clear();s.resources["r"]=Resource(resource_id="r",queue_id="ROOM-A");return s

def test_early_arrival_is_not_hard_eligible():
    now=datetime.now(TZ);t=make_task(now=now,appointment_start=now+timedelta(hours=1),physical_arrival_at=now-timedelta(hours=2),checkin_at=now,presence_status="CHECKED_IN_EARLY",ready_at=now+timedelta(minutes=40));assert not QueueEngine().hard_eligible(t,[t],now)
def test_early_arrival_does_not_jump_on_time_patient():
    now=datetime.now(TZ);early=make_task("early",now,appointment_start=now+timedelta(hours=1),checkin_at=now,presence_status="CHECKED_IN_EARLY",ready_at=now+timedelta(minutes=40),created_seq=0);ready=make_task("ready",now,created_seq=2);assert [x.task_id for x in QueueEngine().order([early,ready],now)]==["ready"]
def test_walk_in_uses_externally_confirmed_ready_time():
    now=datetime.now(TZ);t=make_task(now=now,ready_at=now+timedelta(minutes=5),eligible_at=now+timedelta(minutes=5),presence_status="READY_AT_ROOM");assert not QueueEngine().hard_eligible(t,[t],now) and QueueEngine().hard_eligible(t,[t],now+timedelta(minutes=5))
def test_physical_and_operational_wait_are_separate(state):
    now=datetime.now(TZ);body={"request_id":"wait","patient_token":"P","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":(now-timedelta(minutes=30)).isoformat(),"eligible_at":(now-timedelta(minutes=30)).isoformat(),"appointment_start":now.isoformat(),"physical_arrival_at":(now-timedelta(minutes=150)).isoformat(),"presence_status":"CHECKED_IN_EARLY","candidate_room_ids":["ROOM-A"]};w=TestClient(main.app).post("/api/v1/estimates/room-options",json=body).json()["options"][0]["wait_breakdown"];assert w["estimated_physical_wait_minutes"]>w["estimated_operational_wait_minutes"] and w["early_arrival_minutes"]==pytest.approx(150,abs=1)
def test_early_checkin_increases_occupancy_not_ready_queue(state):
    now=datetime.now(TZ);state.tasks["early"]=make_task("early",now,physical_arrival_at=now,appointment_start=now+timedelta(hours=1),checkin_at=now,presence_status="CHECKED_IN_EARLY",ready_at=now+timedelta(minutes=40));summary=main.room_summary_data("ROOM-A",now);assert summary["early_checked_in_count"]==1 and summary["physical_waiting_count"]==1 and summary["waiting_ready_count"]==0
def test_prior_window_backlog_is_reported_and_delays_target(state):
    now=datetime.now(TZ);state.tasks["old"]=make_task("old",now,appointment_window_end=now-timedelta(minutes=10),remaining_service_minutes=18,predicted_minutes=18,created_seq=0);summary=main.room_summary_data("ROOM-A",now);body={"request_id":"backlog","patient_token":"P","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":now.isoformat(),"candidate_room_ids":["ROOM-A"]};option=TestClient(main.app).post("/api/v1/estimates/room-options",json=body).json()["options"][0];assert summary["backlog_minutes"]==18 and summary["backlog_task_count"]==1 and option["ewt"]["p50_minutes"]>=15 and "PRIOR_WINDOW_BACKLOG" in option["reason_codes"]
def test_completed_task_not_in_backlog(state):
    now=datetime.now(TZ);state.tasks["done"]=make_task("done",now,appointment_window_end=now-timedelta(minutes=10),readiness_status="COMPLETED");assert main.room_summary_data("ROOM-A",now)["backlog_task_count"]==0
def test_in_other_service_does_not_block_ready_patient():
    now=datetime.now(TZ);other=make_task("other",now,presence_status="IN_OTHER_SERVICE",predicted_available_at=now+timedelta(minutes=20),created_seq=0);ready=make_task("ready",now,created_seq=1);assert [x.task_id for x in QueueEngine().order([other,ready],now)]==["ready"]
def test_in_other_service_participates_in_future_workload():
    now=datetime.now(TZ);engine=QueueEngine();resource=[Resource(resource_id="r",queue_id="ROOM-A")];other=make_task("other",now,presence_status="IN_OTHER_SERVICE",predicted_available_at=now+timedelta(minutes=5),created_seq=0);target=make_task("target",now,ready_at=now+timedelta(minutes=20),eligible_at=now+timedelta(minutes=20),created_seq=2);a=engine.monte_carlo(target,[target],resource,now,runs=100,seed=9);b=engine.monte_carlo(target,[other,target],resource,now,runs=100,seed=9);assert b["ewt_p80_minutes"]>=a["ewt_p80_minutes"]
def test_other_service_completed_increments_version_and_requotes(state):
    now=datetime.now(TZ);apply_event(state,evt("create","PATIENT_CHECKED_IN",when=now));apply_event(state,evt("left","PATIENT_LEFT_FOR_OTHER_SERVICE",when=now+timedelta(minutes=1),metadata={"predicted_available_at":(now+timedelta(minutes=20)).isoformat()}));version=state.version;apply_event(state,evt("complete","OTHER_SERVICE_COMPLETED",when=now+timedelta(minutes=2)));assert state.version==version+1 and state.tasks["t"].presence_status==PresenceStatus.RETURNING
def test_returned_to_queue_becomes_hard_eligible(state):
    now=datetime.now(TZ);apply_event(state,evt("create","PATIENT_CHECKED_IN",when=now));apply_event(state,evt("left","PATIENT_LEFT_FOR_OTHER_SERVICE",when=now+timedelta(minutes=1)));apply_event(state,evt("returned","PATIENT_RETURNED_TO_QUEUE",when=now+timedelta(minutes=2)));t=state.tasks["t"];assert t.presence_status==PresenceStatus.ARRIVED_AT_ROOM and QueueEngine().hard_eligible(t,list(state.tasks.values()),now+timedelta(minutes=2))
def test_in_other_service_is_not_marked_no_show(state):
    now=datetime.now(TZ);apply_event(state,evt("create","PATIENT_CHECKED_IN",when=now));apply_event(state,evt("left","PATIENT_LEFT_FOR_OTHER_SERVICE",when=now+timedelta(minutes=1)));apply_event(state,evt("noshow","NO_SHOW_CONFIRMED",when=now+timedelta(minutes=10)));assert state.tasks["t"].readiness_status!=ReadinessStatus.NO_SHOW_HOLD and state.list_audits()[-1].action=="NO_SHOW_SUPPRESSED"
def test_missed_call_grace_period(state):
    now=datetime.now(TZ);apply_event(state,evt("create","PATIENT_CHECKED_IN",when=now));apply_event(state,evt("missed","TASK_MISSED_CALL",when=now+timedelta(minutes=1)));apply_event(state,evt("early-no-show","NO_SHOW_CONFIRMED",when=now+timedelta(minutes=3)));assert state.tasks["t"].readiness_status!=ReadinessStatus.NO_SHOW_HOLD;apply_event(state,evt("late-no-show","NO_SHOW_CONFIRMED",when=now+timedelta(minutes=7)));assert state.tasks["t"].readiness_status==ReadinessStatus.NO_SHOW_HOLD
def test_cross_room_presence_restored_after_restart(tmp_path):
    url=f"sqlite:///{(tmp_path/'restart-cross.db').as_posix()}";s=Store(url);now=datetime.now(TZ);apply_event(s,evt("create","PATIENT_CHECKED_IN",when=now));apply_event(s,evt("left","PATIENT_LEFT_FOR_OTHER_SERVICE",when=now+timedelta(minutes=1),metadata={"destination_queue_id":"ROOM-B","destination_task_id":"tb","predicted_available_at":(now+timedelta(minutes=20)).isoformat()}));restored=Store(url);t=restored.tasks["t"];assert t.presence_status==PresenceStatus.IN_OTHER_SERVICE and t.current_location=="ROOM-B" and t.current_task_id=="tb"
def test_duplicate_cross_room_event_after_restart(tmp_path):
    url=f"sqlite:///{(tmp_path/'duplicate-cross.db').as_posix()}";s=Store(url);now=datetime.now(TZ);apply_event(s,evt("create","PATIENT_CHECKED_IN",when=now));left=evt("left","PATIENT_LEFT_FOR_OTHER_SERVICE",when=now+timedelta(minutes=1));assert apply_event(s,left);restored=Store(url);version=restored.version;assert apply_event(restored,left) is False and restored.version==version
def test_legacy_room_options_request_remains_valid(state):
    body={"request_id":"legacy","patient_token":"P","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":datetime.now(TZ).isoformat(),"candidate_room_ids":["ROOM-A"],"dry_run":True};assert TestClient(main.app).post("/api/v1/estimates/room-options",json=body).status_code==200
def test_early_arrival_dry_run_does_not_write_db(state):
    now=datetime.now(TZ);before=(state.version,len(state.events),len(state.tasks));body={"request_id":"dry","patient_token":"P","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":(now+timedelta(minutes=40)).isoformat(),"appointment_start":(now+timedelta(hours=1)).isoformat(),"physical_arrival_at":now.isoformat(),"presence_status":"CHECKED_IN_EARLY","candidate_room_ids":["ROOM-A"],"dry_run":True};assert TestClient(main.app).post("/api/v1/estimates/room-options",json=body).status_code==200;assert (state.version,len(state.events),len(state.tasks))==before
def test_openapi_contains_new_room_option_fields():
    props=main.app.openapi()["components"]["schemas"]["RoomOptionsRequest"]["properties"];assert {"appointment_start","physical_arrival_at","eligible_at","presence_status","predicted_available_at","dependency_task_ids"}<=set(props)
def test_old_database_snapshot_migrates_without_data_loss(tmp_path):
    url=f"sqlite:///{(tmp_path/'old.db').as_posix()}";engine=make_engine(url);Base.metadata.create_all(engine);payload=json.dumps({"task_id":"old","journey_id":"j","patient_token":"P","queue_id":"Q","task_type":"INITIAL_CONSULT","ready_at":datetime.now(TZ).isoformat(),"predicted_minutes":10})
    with Session(engine) as db,db.begin():db.add(TaskRecord(task_id="old",queue_id="Q",payload=payload,version=1));db.add(MetaRecord(key="version",value="1"))
    first=migrate(url);second=migrate(url);restored=Store(url);assert first["schema_version"]=="2" and second["schema_version"]=="2" and restored.tasks["old"].presence_status==PresenceStatus.READY_AT_ROOM and restored.version==1
