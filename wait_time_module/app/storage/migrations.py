"""Migration local idempotent cho JSON snapshot. Không thay thế Alembic production."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.domain.models import Task
from app.storage.database import Base,MetaRecord,TaskRecord,make_engine

LOCAL_SCHEMA_VERSION="2"
def migrate(database_url:str)->dict:
    engine=make_engine(database_url);Base.metadata.create_all(engine);updated=0
    with Session(engine) as db,db.begin():
        for row in db.scalars(select(TaskRecord)):
            normalized=Task.model_validate_json(row.payload).model_dump_json()
            if normalized!=row.payload:row.payload=normalized;updated+=1
        db.merge(MetaRecord(key="schema_version",value=LOCAL_SCHEMA_VERSION))
    return {"database_url":database_url,"schema_version":LOCAL_SCHEMA_VERSION,"tasks_normalized":updated}
