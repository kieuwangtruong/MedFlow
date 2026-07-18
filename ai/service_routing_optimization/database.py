"""Database access layer for Service Routing Optimization (Mock version).

Provides mock functions for fetching hospital graph edges, equipment statuses, 
queue wait times, journey info, and pending patient tasks without database connection.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session  # Used for type-hint compatibility in router

from .schemas import (
    HospitalEdge,
    Equipment,
    ServiceQueue,
    PatientJourney,
    PatientJourneyTask,
    ClinicRoom,
)

# ---------------------------------------------------------------------------
# Mock Database State
# ---------------------------------------------------------------------------

# Rooms mapped to specialties
CLINIC_ROOMS = [
    ClinicRoom(id="ROOM-GENERAL-101", specialty_id="SPEC-GENERAL-ADULT", name="Phòng khám Tổng quát 101", code="PK-TQ-101", floor="Tầng 1"),
    ClinicRoom(id="ROOM-ER-102", specialty_id="SPEC-ER-TRIAGE", name="Phòng Phân loại Cấp cứu 102", code="CC-102", floor="Tầng 1"),
    ClinicRoom(id="ROOM-CARD-201", specialty_id="SPEC-CARD-CONSULT", name="Phòng khám Tim mạch 201", code="TM-201", floor="Tầng 2"),
    ClinicRoom(id="ROOM-NEURO-202", specialty_id="SPEC-NEURO-CONSULT", name="Phòng khám Thần kinh 202", code="TK-202", floor="Tầng 2"),
    ClinicRoom(id="ROOM-ENT-203", specialty_id="SPEC-ENT-CONSULT", name="Phòng khám Tai Mũi Họng 203", code="TMH-203", floor="Tầng 2"),
    ClinicRoom(id="ROOM-DERM-204", specialty_id="SPEC-DERM-CONSULT", name="Phòng khám Da liễu 204", code="DL-204", floor="Tầng 2"),
    ClinicRoom(id="ROOM-PED-301", specialty_id="SPEC-PED-CONSULT", name="Phòng khám Nhi 301", code="NK-301", floor="Tầng 3"),
    ClinicRoom(id="ROOM-OBGYN-302", specialty_id="SPEC-OBGYN-CONSULT", name="Phòng khám Sản Phụ khoa 302", code="SPK-302", floor="Tầng 3"),
    ClinicRoom(id="ROOM-ORTHO-303", specialty_id="SPEC-ORTHO-CONSULT", name="Phòng khám Cơ Xương Khớp 303", code="CXK-303", floor="Tầng 3"),
    ClinicRoom(id="ROOM-GASTRO-304", specialty_id="SPEC-GASTRO-CONSULT", name="Phòng khám Tiêu hóa - Gan mật 304", code="TH-304", floor="Tầng 3"),
    ClinicRoom(id="ROOM-RESP-401", specialty_id="SPEC-RESP-CONSULT", name="Phòng khám Hô hấp 401", code="HH-401", floor="Tầng 4"),
    ClinicRoom(id="ROOM-URO-402", specialty_id="SPEC-URO-CONSULT", name="Phòng khám Tiết niệu 402", code="TN-402", floor="Tầng 4"),
    ClinicRoom(id="ROOM-OPH-403", specialty_id="SPEC-OPH-CONSULT", name="Phòng khám Mắt 403", code="MAT-403", floor="Tầng 4"),
    ClinicRoom(id="ROOM-ENDO-404", specialty_id="SPEC-ENDO-CONSULT", name="Phòng khám Nội tiết 404", code="NT-404", floor="Tầng 4"),
    ClinicRoom(id="ROOM-PSYCH-405", specialty_id="SPEC-PSYCH-CONSULT", name="Phòng khám Tâm thần - Tâm lý 405", code="TTL-405", floor="Tầng 4"),
]

# Graph edges (travel times). We connect reception to all rooms, and rooms to other rooms.
# For simplicity, we define a star topology from "reception" to all rooms,
# plus some interconnection edges to make routing paths interesting.
MOCK_EDGES = []
rooms_list = ["ROOM-GENERAL-101", "ROOM-ER-102", "ROOM-CARD-201", "ROOM-NEURO-202", 
              "ROOM-ENT-203", "ROOM-DERM-204", "ROOM-PED-301", "ROOM-OBGYN-302", 
              "ROOM-ORTHO-303", "ROOM-GASTRO-304", "ROOM-RESP-401", "ROOM-URO-402", 
              "ROOM-OPH-403", "ROOM-ENDO-404", "ROOM-PSYCH-405"]

# Add reception to each room edges
for idx, room in enumerate(rooms_list):
    MOCK_EDGES.append(HospitalEdge(
        id=f"edge_reception_{room}",
        from_room_id="reception",
        to_room_id=room,
        travel_minutes=float(1.5 + (idx % 4) * 0.5)
    ))

# Add some cross-room connections (e.g. adjacent rooms or elevator/stairs travel between floors)
for i in range(len(rooms_list) - 1):
    MOCK_EDGES.append(HospitalEdge(
        id=f"edge_{rooms_list[i]}_{rooms_list[i+1]}",
        from_room_id=rooms_list[i],
        to_room_id=rooms_list[i+1],
        travel_minutes=1.0 if (i % 4 != 3) else 3.0  # 1.0 min on same floor, 3.0 mins to next floor
    ))

# Equipment statuses
MOCK_EQUIPMENTS = []
for idx, room in enumerate(rooms_list):
    # Set ROOM-PSYCH-405's equipment to INACTIVE for testing fallback/filtering logic
    status = "INACTIVE" if room == "ROOM-PSYCH-405" else "ACTIVE"
    MOCK_EQUIPMENTS.append(Equipment(
        id=f"eq_{room}",
        name=f"Thiết bị tại {room}",
        code=f"EQ-CODE-{idx+100}",
        room_id=room,
        status=status
    ))

# Service queues (wait times)
MOCK_QUEUES = []
for idx, room in enumerate(rooms_list):
    # Various wait times for different rooms
    wait_time = float((idx % 5) * 5.0 + 5.0)  # 5, 10, 15, 20, 25 minutes
    MOCK_QUEUES.append(ServiceQueue(
        id=f"queue_{room}",
        name=f"Hàng đợi {room}",
        room_id=room,
        service_type=f"SERVICE-{room}",
        is_active=True,
        estimated_wait_minutes=wait_time
    ))

# ---------------------------------------------------------------------------
# Lazy engine / session factory (Bypassed for Mock Mode)
# ---------------------------------------------------------------------------

def _get_engine():
    # Bypassed - no engine needed in mock mode
    return None

def get_db():
    """FastAPI dependency that yields None as DB session."""
    yield None

# ---------------------------------------------------------------------------
# Mock Query functions
# ---------------------------------------------------------------------------

def get_hospital_edges(db: Session) -> list[HospitalEdge]:
    """Return all mock hospital graph edges."""
    return MOCK_EDGES

def get_equipment_statuses(db: Session) -> list[Equipment]:
    """Return all mock equipment records."""
    return MOCK_EQUIPMENTS

def get_queue_wait_times(db: Session) -> list[ServiceQueue]:
    """Return all mock active service queues with their estimated wait times."""
    return [q for q in MOCK_QUEUES if q.is_active]

def get_journey_info(db: Session, journey_id: str) -> PatientJourney | None:
    """Return mock journey info based on journey_id."""
    token = journey_id.replace("journey_", "")
    return PatientJourney(
        id=journey_id,
        patient_token=token,
        checkin_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        severity_score=50,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=35),
    )

def get_journey_by_token(db: Session, patient_token: str) -> PatientJourney | None:
    """Return the latest mock journey info for a given patient_token."""
    return PatientJourney(
        id=f"journey_{patient_token}",
        patient_token=patient_token,
        checkin_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        severity_score=50,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=35),
    )

def get_pending_tasks(
    db: Session, journey_id: str, clinic_specialities: list[str]
) -> list[PatientJourneyTask]:
    """Return mock tasks with status PENDING or READY for a given journey and matching clinic_specialities."""
    patient_token = journey_id.replace("journey_", "")
    
    # Map specialties to rooms & service names
    spec_map = {
        "SPEC-GENERAL-ADULT": ("ROOM-GENERAL-101", "Khám Nội tổng quát"),
        "SPEC-ER-TRIAGE": ("ROOM-ER-102", "Tiếp nhận và Phân loại cấp cứu"),
        "SPEC-CARD-CONSULT": ("ROOM-CARD-201", "Khám Tim mạch"),
        "SPEC-NEURO-CONSULT": ("ROOM-NEURO-202", "Khám Thần kinh"),
        "SPEC-ENT-CONSULT": ("ROOM-ENT-203", "Khám Tai Mũi Họng"),
        "SPEC-DERM-CONSULT": ("ROOM-DERM-204", "Khám Da liễu"),
        "SPEC-PED-CONSULT": ("ROOM-PED-301", "Khám Nhi tổng quát"),
        "SPEC-OBGYN-CONSULT": ("ROOM-OBGYN-302", "Khám Sản Phụ khoa"),
        "SPEC-ORTHO-CONSULT": ("ROOM-ORTHO-303", "Khám Cơ Xương Khớp"),
        "SPEC-GASTRO-CONSULT": ("ROOM-GASTRO-304", "Khám Tiêu hóa - Gan mật"),
        "SPEC-RESP-CONSULT": ("ROOM-RESP-401", "Khám Hô hấp"),
        "SPEC-URO-CONSULT": ("ROOM-URO-402", "Khám Tiết niệu"),
        "SPEC-OPH-CONSULT": ("ROOM-OPH-403", "Khám Mắt"),
        "SPEC-ENDO-CONSULT": ("ROOM-ENDO-404", "Khám Nội tiết"),
        "SPEC-PSYCH-CONSULT": ("ROOM-PSYCH-405", "Khám Tâm thần - Tâm lý"),
    }
    
    tasks = []
    for idx, spec in enumerate(clinic_specialities):
        room_id, service_name = spec_map.get(spec, ("reception", f"Dịch vụ {spec}"))
        
        # Distribute priorities for testing
        priorities = ["NORMAL", "URGENT", "EMERGENCY", "NON_URGENT"]
        priority = priorities[idx % len(priorities)]
        
        # Ensure status is PENDING or READY so get_pending_tasks includes it
        status = "READY" if idx == 0 else "PENDING"
        
        tasks.append(
            PatientJourneyTask(
                id=f"task_{idx + 1}",
                journey_id=journey_id,
                patient_token=patient_token,
                service_type=service_name,
                clinical_priority=priority,
                specialty_id=spec,
                room_id=room_id,
                status=status,
                sequence_order=None,
            )
        )
    return tasks

def get_patient_current_location(
    db: Session, journey_id: str
) -> str | None:
    """Determine the patient's current room from completed/in-service tasks."""
    return None
