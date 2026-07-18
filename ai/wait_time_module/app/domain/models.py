from __future__ import annotations

from datetime import datetime
from datetime import timedelta
import os
try:
    from enum import StrEnum
except ImportError:  # Python 3.10 compatibility for the shared AI virtualenv
    from enum import Enum

    class StrEnum(str, Enum):
        pass
from pydantic import BaseModel, Field, model_validator

class TaskType(StrEnum):
    INITIAL_CONSULT="INITIAL_CONSULT"; DIAGNOSTIC_SERVICE="DIAGNOSTIC_SERVICE"; RETURN_REVIEW="RETURN_REVIEW"; FOLLOW_UP_CONSULT="FOLLOW_UP_CONSULT"
class ClinicalPriority(StrEnum):
    EMERGENCY="EMERGENCY"; URGENT="URGENT"; NORMAL="NORMAL"
class ReadinessStatus(StrEnum):
    WAITING="WAITING"; RESULT_PENDING="RESULT_PENDING"; READY="READY"; RETURNING="RETURNING"; ARRIVED="ARRIVED"; IN_SERVICE="IN_SERVICE"; COMPLETED="COMPLETED"; NO_SHOW_HOLD="NO_SHOW_HOLD"; CANCELLED="CANCELLED"
class SchedulingMode(StrEnum):
    ASAP="ASAP"; FAIR_QUEUE="FAIR_QUEUE"; SCHEDULED_WINDOW="SCHEDULED_WINDOW"
class ResourceStatus(StrEnum):
    AVAILABLE="AVAILABLE"; BUSY="BUSY"; FAILED="FAILED"
class PresenceStatus(StrEnum):
    NOT_ARRIVED="NOT_ARRIVED"; CHECKED_IN_EARLY="CHECKED_IN_EARLY"; AVAILABLE_ON_SITE="AVAILABLE_ON_SITE"; READY_AT_ROOM="READY_AT_ROOM"; IN_OTHER_SERVICE="IN_OTHER_SERVICE"; RETURNING="RETURNING"; ARRIVED_AT_ROOM="ARRIVED_AT_ROOM"; UNKNOWN="UNKNOWN"; LEFT_HOSPITAL="LEFT_HOSPITAL"
class EventType(StrEnum):
    PATIENT_CHECKED_IN="PATIENT_CHECKED_IN"; SERVICE_ORDERED="SERVICE_ORDERED"; ARRIVED_QUEUE="ARRIVED_QUEUE"; SERVICE_STARTED="SERVICE_STARTED"; SERVICE_COMPLETED="SERVICE_COMPLETED"; RESULT_READY="RESULT_READY"; RETURN_STARTED="RETURN_STARTED"; RETURN_ARRIVED="RETURN_ARRIVED"; PRIORITY_CHANGED="PRIORITY_CHANGED"; NO_SHOW_CONFIRMED="NO_SHOW_CONFIRMED"; RESOURCE_AVAILABLE="RESOURCE_AVAILABLE"; RESOURCE_FAILED="RESOURCE_FAILED"; EMERGENCY_ARRIVED="EMERGENCY_ARRIVED"; TASK_CANCELLED="TASK_CANCELLED"; TASK_ASSIGNED_TO_QUEUE="TASK_ASSIGNED_TO_QUEUE"; TASK_REASSIGNED_TO_QUEUE="TASK_REASSIGNED_TO_QUEUE"; PATIENT_ARRIVED="PATIENT_ARRIVED"; PATIENT_CHECKED_IN_EARLY="PATIENT_CHECKED_IN_EARLY"; TASK_BECAME_ELIGIBLE="TASK_BECAME_ELIGIBLE"; PATIENT_READY_AT_QUEUE="PATIENT_READY_AT_QUEUE"; PATIENT_LEFT_FOR_OTHER_SERVICE="PATIENT_LEFT_FOR_OTHER_SERVICE"; OTHER_SERVICE_STARTED="OTHER_SERVICE_STARTED"; OTHER_SERVICE_COMPLETED="OTHER_SERVICE_COMPLETED"; PATIENT_RETURNING_TO_QUEUE="PATIENT_RETURNING_TO_QUEUE"; PATIENT_RETURNED_TO_QUEUE="PATIENT_RETURNED_TO_QUEUE"; PATIENT_LOCATION_UPDATED="PATIENT_LOCATION_UPDATED"; TASK_MISSED_CALL="TASK_MISSED_CALL"

class Task(BaseModel):
    task_id: str; journey_id: str; patient_token: str; queue_id: str
    task_type: TaskType; service_type: str = "CLINICAL_CONSULT"
    clinical_priority: ClinicalPriority = ClinicalPriority.NORMAL
    readiness_status: ReadinessStatus = ReadinessStatus.WAITING
    scheduling_mode: SchedulingMode = SchedulingMode.FAIR_QUEUE
    ready_at: datetime; predicted_minutes: float = Field(ge=0)
    parent_task_id: str|None=None; depends_on_task_id: str|None=None
    resource_id: str|None=None; schedule_window_start: datetime|None=None; schedule_window_end: datetime|None=None
    appointment_start: datetime|None=None; appointment_window_start: datetime|None=None; appointment_window_end: datetime|None=None
    physical_arrival_at: datetime|None=None; checkin_at: datetime|None=None; eligible_at: datetime|None=None
    presence_status: PresenceStatus=PresenceStatus.READY_AT_ROOM
    current_location: str|None=None; current_task_id: str|None=None
    predicted_available_at: datetime|None=None; actual_available_at: datetime|None=None
    dependency_task_ids: list[str]=Field(default_factory=list)
    actual_service_start_at: datetime|None=None; remaining_service_minutes: float|None=Field(default=None,ge=0)
    missed_call_at: datetime|None=None
    estimated_result_ready_at: datetime|None=None; actual_result_ready_at: datetime|None=None
    estimated_return_arrived_at: datetime|None=None; actual_return_arrived_at: datetime|None=None
    ready_for_review_at: datetime|None=None; return_review_sla_minutes: float=15
    created_seq: int=0
    @model_validator(mode="before")
    @classmethod
    def restore_legacy_patient_token(cls, value):
        if isinstance(value, dict) and not value.get("patient_token"):
            value = {**value, "patient_token": value.get("task_id", "UNKNOWN")}
        return value
    @model_validator(mode="after")
    def validate_window(self):
        if self.schedule_window_start and self.schedule_window_end and self.schedule_window_end < self.schedule_window_start: raise ValueError("schedule window end precedes start")
        if self.appointment_window_start and self.appointment_window_end and self.appointment_window_end < self.appointment_window_start: raise ValueError("appointment window end precedes start")
        if self.eligible_at is None:
            if self.appointment_start:
                earliest=self.appointment_start-timedelta(minutes=int(os.getenv("DEFAULT_EARLY_CHECKIN_WINDOW_MINUTES","20")))
                self.eligible_at=max(x for x in (self.checkin_at,earliest) if x is not None)
            else:self.eligible_at=self.ready_at
        return self

class Resource(BaseModel):
    resource_id: str; queue_id: str; status: ResourceStatus=ResourceStatus.AVAILABLE; busy_minutes: float=Field(default=0, ge=0)
    compatible_service_types: set[str] = Field(default_factory=set)

class Event(BaseModel):
    event_id: str; event_time: datetime; journey_id: str; task_id: str; patient_token: str; queue_id: str
    event_type: EventType; task_type: TaskType=TaskType.INITIAL_CONSULT; clinical_priority: ClinicalPriority=ClinicalPriority.NORMAL
    resource_id: str|None=None; metadata: dict = Field(default_factory=dict)
    based_on_estimate_version: int|None=None; actor_id: str="unknown"; actor_type: str="SERVICE"
    correlation_id: str|None=None; reason_code: str|None=None
    @model_validator(mode="after")
    def timezone_required(self):
        if self.event_time.utcoffset() is None: raise ValueError("event_time must include timezone")
        return self

class JourneyTimestamps(BaseModel):
    journey_id: str
    initial_checkin_at: datetime|None=None; initial_consult_started_at: datetime|None=None; initial_consult_completed_at: datetime|None=None
    left_room_a_at: datetime|None=None; arrived_room_b_at: datetime|None=None; service_b_started_at: datetime|None=None; service_b_completed_at: datetime|None=None
    estimated_result_ready_at: datetime|None=None; actual_result_ready_at: datetime|None=None
    estimated_return_arrived_at: datetime|None=None; actual_return_arrived_at: datetime|None=None
    ready_for_review_at: datetime|None=None; review_started_at: datetime|None=None; review_completed_at: datetime|None=None
