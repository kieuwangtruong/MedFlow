from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class OptimizeSequenceRequest(BaseModel):
    clinic_specialities: List[str]
    patient_token: str

class SequenceItem(BaseModel):
    task_id: str
    service_type: str
    room_id: str
    sequence_order: int

class CostMetrics(BaseModel):
    total_cost: float
    travel_cost: float
    queue_cost: float
    priority_penalty: float

class OptimizeSequenceResponse(BaseModel):
    journey_id: str
    patient_token: str
    optimal_sequence: List[SequenceItem]
    metrics: CostMetrics

# Database Schema Mappings as Pydantic Models for Mocking
class HospitalEdge(BaseModel):
    id: str
    from_room_id: str
    to_room_id: str
    travel_minutes: float

class Equipment(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    room_id: str
    status: str = "ACTIVE"

class ServiceQueue(BaseModel):
    id: str
    name: Optional[str] = None
    room_id: Optional[str] = None
    service_type: Optional[str] = None
    is_active: bool = True
    estimated_wait_minutes: float = 0.0

class PatientJourney(BaseModel):
    id: str
    patient_token: str
    checkin_at: Optional[datetime] = None
    severity_score: Optional[int] = None
    created_at: Optional[datetime] = None

class PatientJourneyTask(BaseModel):
    id: str
    journey_id: str
    patient_token: str
    service_type: str
    clinical_priority: str = "NORMAL"
    specialty_id: Optional[str] = None
    room_id: Optional[str] = None
    status: str
    sequence_order: Optional[int] = None
    completed_at: Optional[datetime] = None

class ClinicRoom(BaseModel):
    id: str
    specialty_id: Optional[str] = None
    name: Optional[str] = None
    code: Optional[str] = None
    floor: Optional[str] = None
    is_active: bool = True

