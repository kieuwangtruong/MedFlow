import argparse,json,time
from datetime import datetime
from statistics import median
from zoneinfo import ZoneInfo
import numpy as np
from app.domain.models import Resource,Task
from app.queue_engine.engine import QueueEngine

def main():
    p=argparse.ArgumentParser();p.add_argument("--iterations",type=int,default=30);p.add_argument("--runs",type=int,default=300);a=p.parse_args();now=datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"));tasks=[Task(task_id=f"t{i}",journey_id=f"j{i}",patient_token=f"P{i}",queue_id="ROOM-A",task_type="INITIAL_CONSULT",readiness_status="READY",ready_at=now,predicted_minutes=8+i%7,created_seq=i) for i in range(25)];resources=[Resource(resource_id="r1",queue_id="ROOM-A"),Resource(resource_id="r2",queue_id="ROOM-A")];engine=QueueEngine();latency=[]
    for i in range(a.iterations):
        start=time.perf_counter();engine.monte_carlo(tasks[-1],tasks,resources,now,runs=a.runs,seed=i);latency.append((time.perf_counter()-start)*1000)
    report={"iterations":a.iterations,"runs":a.runs,"tasks":len(tasks),"resources":len(resources),"latency_p50_ms":round(float(np.quantile(latency,.5)),2),"latency_p95_ms":round(float(np.quantile(latency,.95)),2),"latency_max_ms":round(max(latency),2)};print(json.dumps(report,indent=2))
if __name__=="__main__":main()
