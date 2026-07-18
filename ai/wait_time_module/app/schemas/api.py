from datetime import datetime
try:
    from enum import StrEnum
except ImportError:  # Python 3.10 compatibility for the shared AI virtualenv
    from enum import Enum

    class StrEnum(str, Enum):
        pass
from pydantic import BaseModel,Field,model_validator
from ..domain.models import ClinicalPriority,PresenceStatus,TaskType

class EstimateStatus(StrEnum):OK="OK";STALE_DATA="STALE_DATA";RESOURCE_UNAVAILABLE="RESOURCE_UNAVAILABLE";REQUOTE_REQUIRED="REQUOTE_REQUIRED";INVALID_CANDIDATE_ROOM="INVALID_CANDIDATE_ROOM";MODEL_FALLBACK="MODEL_FALLBACK"
class Quantiles(BaseModel):ewt_p50_minutes:int;ewt_p80_minutes:int;ewt_p90_minutes:int;display_min_minutes:int;display_max_minutes:int
class PatientEstimate(BaseModel):
    task_id:str;journey_id:str;queue_id:str;task_type:str;clinical_priority:str;readiness_status:str
    estimate:Quantiles|None;estimate_status:EstimateStatus=EstimateStatus.OK;confidence:str="MEDIUM";reason_codes:list[str]=Field(default_factory=list)
    generated_at:datetime;valid_until:datetime;estimate_version:int;eta:dict[str,datetime|None]=Field(default_factory=dict)
    eligibility:dict|None=None;wait_breakdown:dict|None=None
class EventResponse(BaseModel):accepted:bool;duplicate:bool;event_id:str;estimate_version:int;status:str="OK"
class ScenarioType(StrEnum):EMERGENCY_INSERT="EMERGENCY_INSERT";NO_SHOW="NO_SHOW";RESOURCE_FAILURE="RESOURCE_FAILURE";SERVICE_SLOWDOWN="SERVICE_SLOWDOWN";RESULT_DELAY="RESULT_DELAY";RETURN_URGENT="RETURN_URGENT";RETURN_NORMAL="RETURN_NORMAL"
class ScenarioRequest(BaseModel):scenario_type:ScenarioType;queue_id:str;task_id:str|None=None;resource_id:str|None=None;minutes:float=Field(default=10,ge=0);dry_run:bool=True
class RoomOptionsRequest(BaseModel):
    request_id:str;task_type:TaskType;service_code:str;clinical_priority:ClinicalPriority;ready_at:datetime;candidate_room_ids:list[str];dry_run:bool=True
    appointment_start:datetime|None=None;appointment_window_start:datetime|None=None;appointment_window_end:datetime|None=None
    physical_arrival_at:datetime|None=None;checkin_at:datetime|None=None;eligible_at:datetime|None=None
    presence_status:PresenceStatus=PresenceStatus.READY_AT_ROOM;predicted_available_at:datetime|None=None;dependency_task_ids:list[str]=Field(default_factory=list)
    @model_validator(mode="after")
    def unique_rooms(self):
        self.candidate_room_ids=list(dict.fromkeys(self.candidate_room_ids));return self
class AssignmentImpactRequest(BaseModel):task_type:TaskType;service_code:str;clinical_priority:ClinicalPriority;ready_at:datetime;room_id:str;predicted_minutes:float=Field(default=12,ge=0);dry_run:bool=True
