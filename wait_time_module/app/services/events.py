from __future__ import annotations
import json,os
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from app.domain.models import *

TZ=ZoneInfo("Asia/Ho_Chi_Minh")
class RequoteRequired(ValueError): pass
def _dt(value):return datetime.fromisoformat(value) if isinstance(value,str) else value

def _audit(e,entity_type,entity_id,action,previous,new,reason=None):
    return {"event_id":e.event_id,"entity_type":entity_type,"entity_id":entity_id,"action":action,
        "previous_value":json.dumps(previous,default=str) if previous is not None else None,
        "new_value":json.dumps(new,default=str) if new is not None else None,"reason_code":reason or e.reason_code,
        "actor_id":e.actor_id,"actor_type":e.actor_type,"created_at":datetime.now(TZ),"correlation_id":e.correlation_id}

def apply_event(s,e):
    if e.event_id in s.events:return False
    if e.event_type in {EventType.TASK_ASSIGNED_TO_QUEUE,EventType.TASK_REASSIGNED_TO_QUEUE} and e.based_on_estimate_version!=s.version:
        raise RequoteRequired(f"REQUOTE_REQUIRED: current estimate_version is {s.version}")
    local=e.event_time.astimezone(TZ);key=(e.queue_id,e.task_id if not e.event_type.name.startswith("RESOURCE_") else (e.resource_id or "unknown"))
    previous_time=s.entity_event_times.get(key)
    if previous_time and local<previous_time:raise ValueError("event_time precedes the latest event for this entity")
    t=s.tasks.get(e.task_id);previous_task=t.model_dump(mode="json") if t else None;audits=[]
    creates={EventType.PATIENT_CHECKED_IN,EventType.SERVICE_ORDERED,EventType.ARRIVED_QUEUE,EventType.EMERGENCY_ARRIVED,EventType.TASK_ASSIGNED_TO_QUEUE,EventType.PATIENT_ARRIVED,EventType.PATIENT_CHECKED_IN_EARLY,EventType.PATIENT_READY_AT_QUEUE}
    if not t and e.event_type in creates:
        t=Task(task_id=e.task_id,journey_id=e.journey_id,patient_token=e.patient_token,queue_id=e.queue_id,task_type=e.task_type,
            service_type=e.metadata.get("service_type","CLINICAL_CONSULT"),clinical_priority=e.clinical_priority,
            readiness_status=ReadinessStatus.ARRIVED,scheduling_mode=SchedulingMode(e.metadata.get("scheduling_mode","FAIR_QUEUE")),
            ready_at=e.event_time,predicted_minutes=e.metadata.get("predicted_minutes",12),created_seq=s.version,
            schedule_window_start=e.metadata.get("schedule_window_start"),schedule_window_end=e.metadata.get("schedule_window_end"),
            appointment_start=e.metadata.get("appointment_start"),appointment_window_start=e.metadata.get("appointment_window_start"),appointment_window_end=e.metadata.get("appointment_window_end"),
            physical_arrival_at=e.metadata.get("physical_arrival_at"),checkin_at=e.metadata.get("checkin_at"),eligible_at=e.metadata.get("eligible_at"),
            presence_status=e.metadata.get("presence_status","READY_AT_ROOM"),current_location=e.metadata.get("current_location"),current_task_id=e.metadata.get("current_task_id"),
            predicted_available_at=e.metadata.get("predicted_available_at"),actual_available_at=e.metadata.get("actual_available_at"),dependency_task_ids=e.metadata.get("dependency_task_ids",[]),
            estimated_result_ready_at=e.metadata.get("estimated_result_ready_at"),estimated_return_arrived_at=e.metadata.get("estimated_return_arrived_at"));s.tasks[e.task_id]=t
    if t:
        states={EventType.ARRIVED_QUEUE:ReadinessStatus.ARRIVED,EventType.SERVICE_STARTED:ReadinessStatus.IN_SERVICE,
            EventType.SERVICE_COMPLETED:ReadinessStatus.COMPLETED,EventType.RETURN_STARTED:ReadinessStatus.RETURNING,
            EventType.TASK_CANCELLED:ReadinessStatus.CANCELLED}
        if e.event_type in states:t.readiness_status=states[e.event_type]
        if e.event_type==EventType.SERVICE_COMPLETED and t.task_type==TaskType.DIAGNOSTIC_SERVICE:t.readiness_status=ReadinessStatus.RESULT_PENDING
        if e.event_type==EventType.RESULT_READY:t.actual_result_ready_at=local
        if e.event_type==EventType.RETURN_ARRIVED:t.actual_return_arrived_at=local
        if t.task_type==TaskType.RETURN_REVIEW and t.actual_result_ready_at and t.actual_return_arrived_at:
            t.ready_for_review_at=max(t.actual_result_ready_at,t.actual_return_arrived_at);t.ready_at=t.ready_for_review_at;t.readiness_status=ReadinessStatus.READY
        if e.event_type==EventType.PRIORITY_CHANGED:
            old=t.clinical_priority;t.clinical_priority=e.clinical_priority;audits.append(_audit(e,"TASK",t.task_id,"PRIORITY_CHANGED",old,e.clinical_priority))
        if e.event_type==EventType.SERVICE_STARTED and e.resource_id:t.resource_id=e.resource_id;t.actual_service_start_at=local;t.remaining_service_minutes=float(e.metadata.get("remaining_minutes",t.predicted_minutes))
        if e.event_type==EventType.PATIENT_ARRIVED:t.physical_arrival_at=local;t.presence_status=PresenceStatus.AVAILABLE_ON_SITE;t.current_location=e.metadata.get("current_location",t.current_location)
        if e.event_type==EventType.PATIENT_CHECKED_IN_EARLY:t.physical_arrival_at=t.physical_arrival_at or _dt(e.metadata.get("physical_arrival_at")) or local;t.checkin_at=local;t.presence_status=PresenceStatus.CHECKED_IN_EARLY
        if e.event_type==EventType.TASK_BECAME_ELIGIBLE:t.eligible_at=local
        if e.event_type==EventType.PATIENT_READY_AT_QUEUE:t.ready_at=_dt(e.metadata.get("ready_at")) or local;t.eligible_at=t.eligible_at or t.ready_at;t.presence_status=PresenceStatus.READY_AT_ROOM;t.readiness_status=ReadinessStatus.READY;t.current_location=e.queue_id;t.predicted_available_at=None
        if e.event_type in {EventType.PATIENT_LEFT_FOR_OTHER_SERVICE,EventType.OTHER_SERVICE_STARTED}:
            old=t.presence_status;t.presence_status=PresenceStatus.IN_OTHER_SERVICE;t.readiness_status=ReadinessStatus.WAITING;t.predicted_available_at=_dt(e.metadata.get("predicted_available_at"));t.current_location=e.metadata.get("destination_queue_id",e.metadata.get("current_location"));t.current_task_id=e.metadata.get("destination_task_id",e.metadata.get("current_task_id"));audits.append(_audit(e,"TASK",t.task_id,"PRESENCE_CHANGED",old,t.presence_status,"IN_OTHER_SERVICE"))
        if e.event_type in {EventType.OTHER_SERVICE_COMPLETED,EventType.PATIENT_RETURNING_TO_QUEUE}:
            old=t.presence_status;t.actual_available_at=local if e.event_type==EventType.OTHER_SERVICE_COMPLETED else t.actual_available_at;t.predicted_available_at=_dt(e.metadata.get("predicted_available_at")) or t.predicted_available_at;t.presence_status=PresenceStatus.RETURNING;t.readiness_status=ReadinessStatus.RETURNING
            if e.event_type==EventType.OTHER_SERVICE_COMPLETED:
                completed=e.metadata.get("completed_task_id") or t.current_task_id
                if completed:t.dependency_task_ids=[x for x in t.dependency_task_ids if x!=completed]
            audits.append(_audit(e,"TASK",t.task_id,"PRESENCE_CHANGED",old,t.presence_status,"RETURNING"))
        if e.event_type in {EventType.PATIENT_RETURNED_TO_QUEUE,EventType.RETURN_ARRIVED}:
            old=t.presence_status;t.actual_available_at=local;t.ready_at=local;t.eligible_at=t.eligible_at or local;t.presence_status=PresenceStatus.ARRIVED_AT_ROOM;t.readiness_status=ReadinessStatus.ARRIVED;t.current_location=e.queue_id;t.predicted_available_at=None;audits.append(_audit(e,"TASK",t.task_id,"PRESENCE_CHANGED",old,t.presence_status,"RETURNED_TO_QUEUE"))
        if e.event_type==EventType.PATIENT_LOCATION_UPDATED:t.current_location=e.metadata.get("current_location",t.current_location);t.current_task_id=e.metadata.get("current_task_id",t.current_task_id)
        if e.event_type==EventType.TASK_MISSED_CALL:t.missed_call_at=local;audits.append(_audit(e,"TASK",t.task_id,"TASK_MISSED_CALL",None,local,"GRACE_PERIOD_STARTED"))
        if e.event_type==EventType.NO_SHOW_CONFIRMED:
            grace=timedelta(minutes=int(os.getenv("MISSED_CALL_GRACE_MINUTES","5")))
            if t.presence_status==PresenceStatus.IN_OTHER_SERVICE:audits.append(_audit(e,"TASK",t.task_id,"NO_SHOW_SUPPRESSED",t.presence_status,t.presence_status,"IN_OTHER_SERVICE"))
            elif t.missed_call_at and local<t.missed_call_at+grace:audits.append(_audit(e,"TASK",t.task_id,"NO_SHOW_SUPPRESSED",t.missed_call_at,local,"MISSED_CALL_GRACE_ACTIVE"))
            else:t.readiness_status=ReadinessStatus.NO_SHOW_HOLD;audits.append(_audit(e,"TASK",t.task_id,"NO_SHOW",previous_task,t.model_dump(mode="json")))
        if e.event_type in {EventType.TASK_ASSIGNED_TO_QUEUE,EventType.TASK_REASSIGNED_TO_QUEUE}:
            old_queue=t.queue_id;t.queue_id=e.queue_id;t.created_seq=s.version
            action="ROOM_REASSIGNED" if old_queue!=e.queue_id and previous_task else "ROOM_ASSIGNED"
            audits.append(_audit(e,"TASK",t.task_id,action,old_queue,e.queue_id,"ESTIMATE_VERSION_ACCEPTED"))
    if e.resource_id:
        r=s.resources.get(e.resource_id) or Resource(resource_id=e.resource_id,queue_id=e.queue_id);old=r.model_dump(mode="json")
        if e.event_type==EventType.RESOURCE_FAILED:r.status=ResourceStatus.FAILED
        if e.event_type==EventType.RESOURCE_AVAILABLE:r.status=ResourceStatus.AVAILABLE;r.busy_minutes=0
        if e.event_type==EventType.SERVICE_STARTED:r.status=ResourceStatus.BUSY;r.busy_minutes=float(e.metadata.get("remaining_minutes",t.predicted_minutes if t else 0))
        if e.event_type==EventType.SERVICE_COMPLETED:r.status=ResourceStatus.AVAILABLE;r.busy_minutes=0
        s.resources[e.resource_id]=r
        if e.event_type in {EventType.RESOURCE_FAILED,EventType.RESOURCE_AVAILABLE}:audits.append(_audit(e,"RESOURCE",r.resource_id,e.event_type.value,old,r.model_dump(mode="json")))
    j=s.journeys.get(e.journey_id) or JourneyTimestamps(journey_id=e.journey_id)
    mapping={(EventType.PATIENT_CHECKED_IN,TaskType.INITIAL_CONSULT):"initial_checkin_at",(EventType.SERVICE_STARTED,TaskType.INITIAL_CONSULT):"initial_consult_started_at",
        (EventType.SERVICE_COMPLETED,TaskType.INITIAL_CONSULT):"initial_consult_completed_at",(EventType.ARRIVED_QUEUE,TaskType.DIAGNOSTIC_SERVICE):"arrived_room_b_at",
        (EventType.SERVICE_STARTED,TaskType.DIAGNOSTIC_SERVICE):"service_b_started_at",(EventType.SERVICE_COMPLETED,TaskType.DIAGNOSTIC_SERVICE):"service_b_completed_at",
        (EventType.RESULT_READY,TaskType.RETURN_REVIEW):"actual_result_ready_at",(EventType.RETURN_ARRIVED,TaskType.RETURN_REVIEW):"actual_return_arrived_at",
        (EventType.SERVICE_STARTED,TaskType.RETURN_REVIEW):"review_started_at",(EventType.SERVICE_COMPLETED,TaskType.RETURN_REVIEW):"review_completed_at"}
    field=mapping.get((e.event_type,e.task_type))
    if e.event_type==EventType.RESULT_READY:field="actual_result_ready_at"
    if e.event_type==EventType.RETURN_ARRIVED:field="actual_return_arrived_at"
    if field:setattr(j,field,local)
    for name in ("left_room_a_at","estimated_result_ready_at","estimated_return_arrived_at"):
        if e.metadata.get(name):setattr(j,name,datetime.fromisoformat(e.metadata[name]) if isinstance(e.metadata[name],str) else e.metadata[name])
    if j.actual_result_ready_at and j.actual_return_arrived_at:j.ready_for_review_at=max(j.actual_result_ready_at,j.actual_return_arrived_at)
    if j.ready_for_review_at:
        for review in (x for x in s.tasks.values() if x.journey_id==e.journey_id and x.task_type==TaskType.RETURN_REVIEW):
            review.actual_result_ready_at=j.actual_result_ready_at;review.actual_return_arrived_at=j.actual_return_arrived_at;review.ready_for_review_at=j.ready_for_review_at;review.ready_at=j.ready_for_review_at;review.readiness_status=ReadinessStatus.READY
    s.journeys[e.journey_id]=j;s.events.add(e.event_id);s.entity_event_times[key]=local;s.version+=1;s.updated_at=max(s.updated_at,local)
    s.persist(e,audits);return True
