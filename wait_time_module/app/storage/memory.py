from __future__ import annotations
import json, os
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.domain.models import JourneyTimestamps, Resource, Task
from app.storage.database import AuditRecord, Base, EventRecord, JourneyRecord, MetaRecord, ResourceRecord, TaskRecord, make_engine

TZ=ZoneInfo("Asia/Ho_Chi_Minh")

class Store:
    def __init__(self,database_url:str|None=None):
        self.database_url=database_url or os.getenv("DATABASE_URL","sqlite:///./data/wait_time.db")
        if self.database_url.startswith("sqlite:///./"): os.makedirs("data",exist_ok=True)
        self.engine=make_engine(self.database_url);Base.metadata.create_all(self.engine)
        self.tasks={};self.resources={};self.events=set();self.journeys={};self.version=0;self.updated_at=datetime.now(TZ);self.entity_event_times={}
        self.load()
    def load(self):
        with Session(self.engine) as db:
            self.tasks={r.task_id:Task.model_validate_json(r.payload) for r in db.scalars(select(TaskRecord))}
            self.resources={r.resource_id:Resource.model_validate_json(r.payload) for r in db.scalars(select(ResourceRecord))}
            records=list(db.scalars(select(EventRecord)));self.events={r.event_id for r in records}
            self.journeys={r.journey_id:JourneyTimestamps.model_validate_json(r.payload) for r in db.scalars(select(JourneyRecord))}
            meta={r.key:r.value for r in db.scalars(select(MetaRecord))};self.version=int(meta.get("version",0))
            if meta.get("updated_at"): self.updated_at=datetime.fromisoformat(meta["updated_at"])
            self.entity_event_times=json.loads(meta.get("entity_event_times","{}"))
            self.entity_event_times={tuple(k.split("|",1)):datetime.fromisoformat(v) for k,v in self.entity_event_times.items()}
    def persist(self,event,audits:list[dict]):
        with Session(self.engine) as db,db.begin():
            db.add(EventRecord(event_id=event.event_id,event_time=event.event_time,payload=event.model_dump_json()))
            for t in self.tasks.values():db.merge(TaskRecord(task_id=t.task_id,queue_id=t.queue_id,payload=t.model_dump_json(),version=self.version))
            for r in self.resources.values():db.merge(ResourceRecord(resource_id=r.resource_id,queue_id=r.queue_id,payload=r.model_dump_json(),version=self.version))
            for j in self.journeys.values():db.merge(JourneyRecord(journey_id=j.journey_id,payload=j.model_dump_json(),version=self.version))
            encoded={"|".join(str(x) for x in k):v.isoformat() for k,v in self.entity_event_times.items()}
            db.merge(MetaRecord(key="version",value=str(self.version)));db.merge(MetaRecord(key="updated_at",value=self.updated_at.isoformat()));db.merge(MetaRecord(key="entity_event_times",value=json.dumps(encoded)))
            for a in audits:db.add(AuditRecord(**a))
    def audit(self,**values):
        with Session(self.engine) as db,db.begin():db.add(AuditRecord(**values))
    def list_audits(self):
        with Session(self.engine) as db:return list(db.scalars(select(AuditRecord).order_by(AuditRecord.audit_id)))
    def reset(self,persist:bool=True):
        if persist:
            with Session(self.engine) as db,db.begin():
                for model in (AuditRecord,EventRecord,TaskRecord,ResourceRecord,JourneyRecord,MetaRecord):db.execute(delete(model))
        self.tasks={};self.resources={};self.events=set();self.journeys={};self.version=0;self.updated_at=datetime.now(TZ);self.entity_event_times={}

store=Store()
