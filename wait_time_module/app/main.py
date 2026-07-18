from __future__ import annotations
from copy import deepcopy
from datetime import datetime,timedelta
import json,os
from pathlib import Path
from time import perf_counter
from uuid import uuid4
from zoneinfo import ZoneInfo
from fastapi import Depends,FastAPI,HTTPException
from app.domain.models import *
from app.ml.predictor import DurationPredictor
from app.queue_engine.engine import ELIGIBLE,QueueEngine
from app.schemas.api import *
from app.services.auth import Principal,require_scope
from app.services.events import RequoteRequired,apply_event
from app.storage.memory import store

TZ=ZoneInfo("Asia/Ho_Chi_Minh");STALE_AFTER=timedelta(seconds=int(os.getenv("STALE_AFTER_SECONDS","120")))
app=FastAPI(title="AI-Native Wait-Time & Queue Engine",version="1.0.0");engine=QueueEngine();predictor=DurationPredictor(os.getenv("MODEL_ARTIFACT_DIR","artifacts"));estimate_cache={}
def resources(q):return [r for r in store.resources.values() if r.queue_id==q]
def tasks(q):return [t for t in store.tasks.values() if t.queue_id==q]
def active_resources(q):return [r for r in resources(q) if r.status!=ResourceStatus.FAILED]
def room_exists(q):return bool(resources(q) or tasks(q))
def features(service_code,queue_id,now):return {"service_type":service_code,"queue_id":queue_id,"doctor_id":"UNKNOWN","device_id":"UNKNOWN","hour":now.hour,"day_of_week":now.weekday(),"case_complexity":"NORMAL","resource_status":"AVAILABLE","arrival_rate_15m":0,"avg_service_30m":12,"recent_emergency_count":0}
def future_tasks(q,now):return [t for t in tasks(q) if t.readiness_status not in {ReadinessStatus.COMPLETED,ReadinessStatus.CANCELLED,ReadinessStatus.NO_SHOW_HOLD,ReadinessStatus.IN_SERVICE} and not engine.hard_eligible(t,tasks(q),now)]
def backlog(q,now):
    items=[t for t in tasks(q) if t.appointment_window_end and t.appointment_window_end<now and t.readiness_status not in {ReadinessStatus.COMPLETED,ReadinessStatus.CANCELLED,ReadinessStatus.NO_SHOW_HOLD} and engine.hard_eligible(t,tasks(q),now)]
    return items,round(sum(t.remaining_service_minutes if t.remaining_service_minutes is not None else t.predicted_minutes for t in items),2)
def room_summary_data(q,now):
    room_tasks=tasks(q);backlog_items,backlog_minutes=backlog(q,now);physical=[t for t in room_tasks if t.physical_arrival_at and t.presence_status!=PresenceStatus.LEFT_HOSPITAL and t.readiness_status not in {ReadinessStatus.COMPLETED,ReadinessStatus.CANCELLED}]
    return {"room_id":q,"resource_status":"AVAILABLE" if active_resources(q) else "RESOURCE_UNAVAILABLE","active_resources":len(active_resources(q)),"waiting_ready_count":len(engine.order(room_tasks,now)),"future_task_count":len(future_tasks(q,now)),"early_checked_in_count":sum(t.presence_status==PresenceStatus.CHECKED_IN_EARLY for t in room_tasks),"physical_waiting_count":len(physical),"in_other_service_count":sum(t.presence_status==PresenceStatus.IN_OTHER_SERVICE for t in room_tasks),"backlog_minutes":backlog_minutes,"backlog_task_count":len(backlog_items),"current_load":round(sum(t.predicted_minutes for t in room_tasks if t.readiness_status not in {ReadinessStatus.COMPLETED,ReadinessStatus.CANCELLED,ReadinessStatus.NO_SHOW_HOLD})/max(1,len(active_resources(q))),2),"data_freshness_seconds":max(0,round((now-store.updated_at).total_seconds(),2)),"estimate_version":store.version}

@app.get("/health")
def health():return {"status":"ok","timezone":str(TZ),"database":store.database_url.split(":",1)[0],"estimate_version":store.version}

@app.post("/api/v1/events",response_model=EventResponse)
def event(e:Event,principal:Principal=Depends(require_scope("events.write"))):
    if e.actor_id=="unknown":e.actor_id=principal.actor_id;e.actor_type=principal.actor_type
    if "predicted_minutes" not in e.metadata and e.event_type in {EventType.PATIENT_CHECKED_IN,EventType.SERVICE_ORDERED,EventType.TASK_ASSIGNED_TO_QUEUE}:
        prediction=predictor.predict_service_duration(features(e.metadata.get("service_type","CLINICAL_CONSULT"),e.queue_id,e.event_time));e.metadata["predicted_minutes"]=prediction["p50"]
    try:accepted=apply_event(store,e)
    except RequoteRequired as exc:
        store.audit(event_id=e.event_id,entity_type="TASK",entity_id=e.task_id,action="ASSIGNMENT_REJECTED",previous_value=str(e.based_on_estimate_version),new_value=str(store.version),reason_code="REQUOTE_REQUIRED",actor_id=e.actor_id,actor_type=e.actor_type,created_at=datetime.now(TZ),correlation_id=e.correlation_id)
        raise HTTPException(409,{"status":"REQUOTE_REQUIRED","current_estimate_version":store.version,"message":str(exc)}) from exc
    except ValueError as exc:
        store.audit(event_id=e.event_id,entity_type="EVENT",entity_id=e.task_id,action="EVENT_REJECTED",previous_value=None,new_value=e.model_dump_json(),reason_code="INVALID_EVENT_ORDER",actor_id=e.actor_id,actor_type=e.actor_type,created_at=datetime.now(TZ),correlation_id=e.correlation_id)
        raise HTTPException(409,str(exc)) from exc
    return EventResponse(accepted=accepted,duplicate=not accepted,event_id=e.event_id,estimate_version=store.version)

def estimate_task(t:Task,now:datetime|None=None):
    now=now or datetime.now(TZ);key=(t.queue_id,store.version,t.task_id)
    if key in estimate_cache:return estimate_cache[key]
    rs=active_resources(t.queue_id);status="STALE_DATA" if now-store.updated_at>STALE_AFTER else "OK";reason=[]
    compatible=[r for r in rs if not r.compatible_service_types or t.service_type in r.compatible_service_types]
    if not compatible:status="RESOURCE_UNAVAILABLE";estimate=None
    else:estimate=engine.monte_carlo(t,tasks(t.queue_id),rs,now)
    if predictor.using_fallback:reason.append("MODEL_FALLBACK")
    hard=engine.hard_eligible(t,tasks(t.queue_id),now);eligibility={"eligible_at":t.eligible_at,"hard_eligible":hard,"presence_status":t.presence_status}
    wait_breakdown=None
    if estimate:
        start=now+timedelta(minutes=estimate["ewt_p50_minutes"]);physical=max(0,(start-t.physical_arrival_at).total_seconds()/60) if t.physical_arrival_at else None;base=max(x for x in (t.eligible_at,t.ready_at,t.predicted_available_at) if x is not None);operational=max(0,(start-base).total_seconds()/60);early=max(0,((t.appointment_start or t.eligible_at)-t.physical_arrival_at).total_seconds()/60) if t.physical_arrival_at and (t.appointment_start or t.eligible_at) else 0
        wait_breakdown={"estimated_physical_wait_minutes":round(physical,2) if physical is not None else None,"estimated_operational_wait_minutes":round(operational,2),"early_arrival_minutes":round(early,2),"backlog_minutes":backlog(t.queue_id,now)[1]}
    if t.actual_service_start_at:
        base=max(x for x in (t.eligible_at,t.ready_at) if x is not None);wait_breakdown={"physical_wait_minutes":round(max(0,(t.actual_service_start_at-t.physical_arrival_at).total_seconds()/60),2) if t.physical_arrival_at else None,"operational_wait_minutes":round(max(0,(t.actual_service_start_at-base).total_seconds()/60),2),"early_arrival_minutes":round(max(0,((t.appointment_start or t.eligible_at)-t.physical_arrival_at).total_seconds()/60),2) if t.physical_arrival_at and (t.appointment_start or t.eligible_at) else 0,"backlog_minutes":backlog(t.queue_id,now)[1],"source":"ACTUAL"}
    result=PatientEstimate(patient_token=t.patient_token,journey_id=t.journey_id,queue_id=t.queue_id,task_type=t.task_type,clinical_priority=t.clinical_priority,readiness_status=t.readiness_status,estimate=estimate,estimate_status=status,generated_at=now,valid_until=now+timedelta(minutes=2),estimate_version=store.version,reason_codes=reason,eligibility=eligibility,wait_breakdown=wait_breakdown)
    estimate_cache[key]=result;return result

@app.get("/api/v1/patients/{patient_token}/estimate",response_model=PatientEstimate)
def patient(patient_token:str,_=Depends(require_scope("wait.read"))):
    found=[t for t in store.tasks.values() if t.patient_token==patient_token and t.readiness_status not in {ReadinessStatus.COMPLETED,ReadinessStatus.CANCELLED,ReadinessStatus.NO_SHOW_HOLD}]
    if not found:raise HTTPException(404,"active patient task not found")
    return estimate_task(found[-1])

@app.get("/api/v1/queues/{queue_id}/estimates")
def queue(queue_id:str,_=Depends(require_scope("wait.read"))):return [estimate_task(t) for t in engine.order(tasks(queue_id),datetime.now(TZ))]

@app.get("/api/v1/journeys/{journey_id}/estimate")
def journey(journey_id:str,_=Depends(require_scope("wait.read"))):
    found=[t for t in store.tasks.values() if t.journey_id==journey_id];j=store.journeys.get(journey_id)
    if not found and not j:raise HTTPException(404,"journey not found")
    review=next((x for x in found if x.task_type==TaskType.RETURN_REVIEW),None);q=estimate_task(review).estimate if review else None
    return {"journey_id":journey_id,"timestamps":j.model_dump() if j else {},"timestamp_source":{"actual_result_ready_at":"ACTUAL" if j and j.actual_result_ready_at else "UNAVAILABLE","actual_return_arrived_at":"ACTUAL" if j and j.actual_return_arrived_at else "UNAVAILABLE","ready_for_review_at":"DERIVED_FROM_ACTUALS" if j and j.ready_for_review_at else "UNAVAILABLE"},"return_ewt":q.model_dump() if q else None,"steps":[{"task_id":t.task_id,"task_type":t.task_type,"status":t.readiness_status} for t in found],"estimate_version":store.version}

def impact(room_id,temp,now):
    current=tasks(room_id);rs=active_resources(room_id);base=engine.schedule(current,rs,now,include_future=True);after=engine.schedule(current+[temp],rs,now,include_future=True);deltas=[];breaches=0
    for t in current:
        if t.task_id in base and t.task_id in after:
            delta=max(0,after[t.task_id]-base[t.task_id]);
            if delta>0:deltas.append(delta)
            if base[t.task_id]<=t.return_review_sla_minutes<after[t.task_id]:breaches+=1
    capacity=max(1,len(rs));before=sum(t.predicted_minutes for t in current)/capacity;after_load=before+temp.predicted_minutes/capacity
    return {"affected_patients":len(deltas),"average_added_wait_minutes":round(sum(deltas)/len(deltas),2) if deltas else 0,"max_added_wait_minutes":round(max(deltas),2) if deltas else 0,"sla_breach_count":breaches,"room_load_before":round(before,2),"room_load_after":round(after_load,2)}

def option_for(room_id,req,now):
    if not room_exists(room_id):return {"room_id":room_id,"estimate_status":"INVALID_CANDIDATE_ROOM","estimate":None,"reason_codes":["ROOM_NOT_FOUND"],"estimate_version":store.version}
    rs=active_resources(room_id);prediction=predictor.predict_service_duration(features(req.service_code,room_id,now));temp=Task(task_id=f"simulation-{req.request_id}-{room_id}",journey_id=f"simulation-{req.request_id}",patient_token=req.patient_token,queue_id=room_id,task_type=req.task_type,service_type=req.service_code,clinical_priority=req.clinical_priority,readiness_status=ReadinessStatus.READY,ready_at=req.ready_at,predicted_minutes=prediction["p50"],created_seq=store.version+1,appointment_start=req.appointment_start,appointment_window_start=req.appointment_window_start,appointment_window_end=req.appointment_window_end,physical_arrival_at=req.physical_arrival_at,checkin_at=req.checkin_at,eligible_at=req.eligible_at,presence_status=req.presence_status,predicted_available_at=req.predicted_available_at,dependency_task_ids=req.dependency_task_ids)
    if not rs:return {"room_id":room_id,"estimate_status":"RESOURCE_UNAVAILABLE","estimate":None,"reason_codes":["NO_ACTIVE_RESOURCE"],"estimate_version":store.version}
    q=engine.monte_carlo(temp,tasks(room_id)+[temp],rs,now);ordered=engine.order(tasks(room_id),now);ahead=len(ordered);future=len(future_tasks(room_id,now));p50=q["ewt_p50_minutes"];p80=q["ewt_p80_minutes"];eta50=now+timedelta(minutes=p50);hard=engine.hard_eligible(temp,tasks(room_id)+[temp],now);base=max(x for x in (temp.eligible_at,temp.ready_at,temp.predicted_available_at) if x is not None);physical=max(0,(eta50-temp.physical_arrival_at).total_seconds()/60) if temp.physical_arrival_at else None;early=max(0,((temp.appointment_start or temp.eligible_at)-temp.physical_arrival_at).total_seconds()/60) if temp.physical_arrival_at and (temp.appointment_start or temp.eligible_at) else 0;summary=room_summary_data(room_id,now);reasons=[]
    if temp.presence_status==PresenceStatus.CHECKED_IN_EARLY and not hard:reasons.append("EARLY_CHECKIN_NOT_YET_ELIGIBLE")
    if temp.presence_status==PresenceStatus.IN_OTHER_SERVICE:reasons.append("IN_OTHER_SERVICE")
    if temp.dependency_task_ids and not hard:reasons.append("DEPENDENCY_NOT_COMPLETED")
    if temp.predicted_available_at:reasons.append("PREDICTED_RETURN_BEFORE_SLOT" if temp.predicted_available_at<=eta50 else "PREDICTED_RETURN_AFTER_SLOT")
    if summary["backlog_minutes"]>0:reasons.append("PRIOR_WINDOW_BACKLOG")
    if summary["physical_waiting_count"]>=int(os.getenv("WAITING_AREA_HIGH_OCCUPANCY","20")):reasons.append("PHYSICAL_OCCUPANCY_HIGH")
    return {"room_id":room_id,"estimate_status":"OK","queue_ahead":ahead,"active_resources":len(rs),"future_task_count":future,"ewt":{"p50_minutes":p50,"p80_minutes":p80,"p90_minutes":q["ewt_p90_minutes"],"display_min_minutes":q["display_min_minutes"],"display_max_minutes":q["display_max_minutes"]},"service_duration":{"p50_minutes":round(prediction["p50"],2),"p80_minutes":round(prediction["p80"],2)},"eta_start":{"p50":eta50,"p80":now+timedelta(minutes=p80)},"eta_completion":{"p50":eta50+timedelta(minutes=prediction["p50"]),"p80":now+timedelta(minutes=p80+prediction["p80"])},"eligibility":{"eligible_at":temp.eligible_at,"hard_eligible":hard,"presence_status":temp.presence_status},"wait_breakdown":{"estimated_physical_wait_minutes":round(physical,2) if physical is not None else None,"estimated_operational_wait_minutes":round(max(0,(eta50-base).total_seconds()/60),2),"early_arrival_minutes":round(early,2),"backlog_minutes":summary["backlog_minutes"]},"assignment_impact":impact(room_id,temp,now),"reason_codes":(["MODEL_FALLBACK"] if predictor.using_fallback else [])+(["SINGLE_ACTIVE_RESOURCE"] if len(rs)==1 else [])+reasons,"estimate_version":store.version}

@app.get("/api/v1/rooms/status")
def rooms_status(_=Depends(require_scope("wait.read"))):
    now=datetime.now(TZ);ids=sorted({r.queue_id for r in store.resources.values()}|{t.queue_id for t in store.tasks.values()})
    return [room_summary_data(q,now) for q in ids]

@app.get("/api/v1/queues/{queue_id}/summary")
def queue_summary(queue_id:str,_=Depends(require_scope("wait.read"))):
    match=[x for x in rooms_status() if x["room_id"]==queue_id]
    if not match:raise HTTPException(404,"queue not found")
    return match[0]

@app.post("/api/v1/estimates/room-options")
def room_options(req:RoomOptionsRequest,_=Depends(require_scope("wait.read"))):
    limit=int(os.getenv("MAX_CANDIDATE_ROOMS","20"))
    if len(req.candidate_room_ids)>limit:raise HTTPException(422,f"candidate_room_ids exceeds limit {limit}")
    now=datetime.now(TZ);return {"request_id":req.request_id,"patient_token":req.patient_token,"generated_at":now,"valid_until":now+timedelta(minutes=2),"options":[option_for(q,req,now) for q in req.candidate_room_ids]}

@app.post("/api/v1/estimates/assignment-impact")
def assignment_impact(req:AssignmentImpactRequest,_=Depends(require_scope("simulation.run"))):
    if not room_exists(req.room_id):raise HTTPException(422,"INVALID_CANDIDATE_ROOM")
    temp=Task(task_id=f"impact-{uuid4()}",journey_id="dry-run",patient_token=req.patient_token,queue_id=req.room_id,task_type=req.task_type,service_type=req.service_code,clinical_priority=req.clinical_priority,readiness_status=ReadinessStatus.READY,ready_at=req.ready_at,predicted_minutes=req.predicted_minutes,created_seq=store.version+1)
    return {"room_id":req.room_id,"dry_run":True,"assignment_impact":impact(req.room_id,temp,datetime.now(TZ)),"estimate_version":store.version}

@app.post("/api/v1/simulations/scenario")
def scenario(req:ScenarioRequest,_=Depends(require_scope("simulation.run"))):
    simulated_tasks=deepcopy(tasks(req.queue_id));simulated_resources=deepcopy(resources(req.queue_id));factor=1.0
    if req.scenario_type=="NO_SHOW":simulated_tasks=[t for t in simulated_tasks if t.task_id!=req.task_id]
    elif req.scenario_type=="RESOURCE_FAILURE":
        for r in simulated_resources:
            if r.resource_id==req.resource_id:r.status=ResourceStatus.FAILED
    elif req.scenario_type=="SERVICE_SLOWDOWN":factor=1+req.minutes/100
    elif req.scenario_type=="EMERGENCY_INSERT":simulated_tasks.append(Task(task_id="scenario-emergency",journey_id="dry-run",patient_token="SCENARIO",queue_id=req.queue_id,task_type=TaskType.INITIAL_CONSULT,clinical_priority=ClinicalPriority.EMERGENCY,readiness_status=ReadinessStatus.ARRIVED,ready_at=datetime.now(TZ),predicted_minutes=req.minutes,created_seq=-1))
    elif req.scenario_type in {"RETURN_URGENT","RETURN_NORMAL"}:
        priority=ClinicalPriority.URGENT if req.scenario_type=="RETURN_URGENT" else ClinicalPriority.NORMAL
        simulated_tasks.append(Task(task_id="scenario-return",journey_id="dry-run",patient_token="SCENARIO",queue_id=req.queue_id,task_type=TaskType.RETURN_REVIEW,service_type="RESULT_REVIEW",clinical_priority=priority,readiness_status=ReadinessStatus.READY,ready_at=datetime.now(TZ),predicted_minutes=5,created_seq=store.version+1))
    result=engine.schedule(simulated_tasks,simulated_resources,datetime.now(TZ),factor)
    return {"dry_run":True,"scenario_type":req.scenario_type,"projected_start_minutes":result,"result_delay_minutes":req.minutes if req.scenario_type=="RESULT_DELAY" else 0,"persisted":False,"estimate_version":store.version}
