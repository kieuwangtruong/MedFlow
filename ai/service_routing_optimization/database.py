"""Database access layer for Service Routing Optimization.

Provides SQLAlchemy table mappings and query functions for fetching
hospital graph edges, equipment statuses, queue wait times, journey info,
and pending patient tasks. Uses its own engine, independent of other modules.
"""

from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    desc,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker

Base = declarative_base()

# ---------------------------------------------------------------------------
# SQLAlchemy table mappings (read-only mirrors of Prisma-managed tables)
# ---------------------------------------------------------------------------


class HospitalEdge(Base):
    __tablename__ = "hospital_edges"
    id = Column(String, primary_key=True)
    from_room_id = Column(String, nullable=False)
    to_room_id = Column(String, nullable=False)
    travel_minutes = Column(Float, nullable=False)


class Equipment(Base):
    __tablename__ = "equipments"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    code = Column(String)
    room_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default="ACTIVE")


class ServiceQueue(Base):
    __tablename__ = "service_queues"
    id = Column(String, primary_key=True)
    name = Column(String)
    room_id = Column(String)
    service_type = Column(String)
    is_active = Column(Boolean, default=True)
    estimated_wait_minutes = Column(Float, default=0.0)


class PatientJourney(Base):
    __tablename__ = "patient_journeys"
    id = Column("journey_id", String, primary_key=True)
    patient_token = Column(String, nullable=False)
    checkin_at = Column(DateTime(timezone=True))
    severity_score = Column(Integer)
    created_at = Column(DateTime(timezone=True))


class PatientJourneyTask(Base):
    __tablename__ = "patient_journey_tasks"
    id = Column("task_id", String, primary_key=True)
    journey_id = Column(String, nullable=False)
    patient_token = Column(String, nullable=False)
    service_type = Column(String, nullable=False)
    clinical_priority = Column(String, nullable=False, default="NORMAL")
    room_id = Column(String)
    status = Column(String, nullable=False)
    sequence_order = Column(Integer)
    completed_at = Column(DateTime(timezone=True))


class ClinicRoom(Base):
    __tablename__ = "clinic_rooms"
    id = Column(String, primary_key=True)
    specialty_id = Column(String)
    name = Column(String)
    code = Column(String)
    floor = Column(String)
    is_active = Column(Boolean, default=True)


# ---------------------------------------------------------------------------
# Lazy engine / session factory
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def _get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError(
                "DATABASE_URL environment variable is required for "
                "service_routing_optimization"
            )
        connect_args = {}
        if database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(
            database_url,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=_engine
        )
    return _engine


def get_db():
    """FastAPI dependency that yields a database session."""
    _get_engine()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------


def get_hospital_edges(db: Session) -> list[HospitalEdge]:
    """Return all hospital graph edges."""
    return db.query(HospitalEdge).all()


def get_equipment_statuses(db: Session) -> list[Equipment]:
    """Return all equipment records."""
    return db.query(Equipment).all()


def get_queue_wait_times(db: Session) -> list[ServiceQueue]:
    """Return all active service queues with their estimated wait times."""
    return (
        db.query(ServiceQueue)
        .filter(ServiceQueue.is_active.is_(True))
        .all()
    )


def get_journey_info(db: Session, journey_id: str) -> PatientJourney | None:
    """Return journey info including checkin_at and severity_score."""
    return (
        db.query(PatientJourney)
        .filter(PatientJourney.id == journey_id)
        .first()
    )


def get_pending_tasks(
    db: Session, journey_id: str
) -> list[PatientJourneyTask]:
    """Return tasks with status PENDING or READY for a given journey."""
    return (
        db.query(PatientJourneyTask)
        .filter(
            PatientJourneyTask.journey_id == journey_id,
            PatientJourneyTask.status.in_(["PENDING", "READY"]),
        )
        .all()
    )


def get_patient_current_location(
    db: Session, journey_id: str
) -> str | None:
    """Determine the patient's current room from completed/in-service tasks.

    Returns the room_id of the most recently completed or in-service task,
    or None if no such task exists.
    """
    task = (
        db.query(PatientJourneyTask)
        .filter(
            PatientJourneyTask.journey_id == journey_id,
            PatientJourneyTask.status.in_(["IN_SERVICE", "COMPLETED"]),
            PatientJourneyTask.room_id.isnot(None),
        )
        .order_by(desc(PatientJourneyTask.completed_at))
        .first()
    )
    return task.room_id if task else None
