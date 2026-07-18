from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase): pass

class EventRecord(Base):
    __tablename__="events"
    id:Mapped[int]=mapped_column(primary_key=True); event_id:Mapped[str]=mapped_column(String(128),unique=True,index=True)
    event_time:Mapped[datetime]=mapped_column(DateTime(timezone=True)); payload:Mapped[str]=mapped_column(Text)

class TaskRecord(Base):
    __tablename__="queue_tasks"
    task_id:Mapped[str]=mapped_column(String(128),primary_key=True); queue_id:Mapped[str]=mapped_column(String(128),index=True); payload:Mapped[str]=mapped_column(Text); version:Mapped[int]=mapped_column(Integer)

class ResourceRecord(Base):
    __tablename__="resources"
    resource_id:Mapped[str]=mapped_column(String(128),primary_key=True); queue_id:Mapped[str]=mapped_column(String(128),index=True); payload:Mapped[str]=mapped_column(Text); version:Mapped[int]=mapped_column(Integer)

class JourneyRecord(Base):
    __tablename__="journey_timestamps"
    journey_id:Mapped[str]=mapped_column(String(128),primary_key=True); payload:Mapped[str]=mapped_column(Text); version:Mapped[int]=mapped_column(Integer)

class MetaRecord(Base):
    __tablename__="state_meta"
    key:Mapped[str]=mapped_column(String(64),primary_key=True); value:Mapped[str]=mapped_column(Text)

class AuditRecord(Base):
    __tablename__="audit_records"
    audit_id:Mapped[int]=mapped_column(primary_key=True,autoincrement=True)
    event_id:Mapped[str|None]=mapped_column(String(128),index=True); entity_type:Mapped[str]=mapped_column(String(64)); entity_id:Mapped[str]=mapped_column(String(128),index=True)
    action:Mapped[str]=mapped_column(String(64)); previous_value:Mapped[str|None]=mapped_column(Text); new_value:Mapped[str|None]=mapped_column(Text)
    reason_code:Mapped[str|None]=mapped_column(String(128)); actor_id:Mapped[str]=mapped_column(String(128)); actor_type:Mapped[str]=mapped_column(String(64))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True)); correlation_id:Mapped[str|None]=mapped_column(String(128))

def make_engine(url:str):
    args={"check_same_thread":False} if url.startswith("sqlite") else {}
    return create_engine(url,future=True,connect_args=args,pool_pre_ping=True)
