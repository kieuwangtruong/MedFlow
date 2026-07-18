import os
from datetime import datetime
from zoneinfo import ZoneInfo
import httpx
BASE=os.getenv("WAIT_TIME_BASE_URL","http://127.0.0.1:8000");KEY=os.getenv("WAIT_TIME_API_KEY")
headers={"X-API-Key":KEY} if KEY else {}
with httpx.Client(base_url=BASE,headers=headers,timeout=30) as client:
    now=datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"));request={"request_id":"REQ-DEMO-001","patient_token":"A173","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":now.isoformat(),"physical_arrival_at":now.isoformat(),"presence_status":"READY_AT_ROOM","dependency_task_ids":[],"candidate_room_ids":["ROOM-A","ROOM-B"],"dry_run":True}
    quote=client.post("/api/v1/estimates/room-options",json=request);quote.raise_for_status();data=quote.json();print("Room options:",data)
    usable=[x for x in data["options"] if x["estimate_status"]=="OK"]
    if usable:
        # Routing Agent bên ngoài tự chọn; ví dụ chỉ chọn option đầu để minh họa giao thức.
        chosen=usable[0];assignment={"event_id":"EVT-ASSIGN-DEMO-001","event_time":datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).isoformat(),"event_type":"TASK_ASSIGNED_TO_QUEUE","patient_token":"A173","task_id":"TASK-DEMO-001","journey_id":"JOURNEY-DEMO-001","queue_id":chosen["room_id"],"task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL","based_on_estimate_version":chosen["estimate_version"],"actor_id":"ROUTING-AGENT-DEMO","actor_type":"SERVICE","metadata":{"service_type":"CLINICAL_CONSULT"}}
        response=client.post("/api/v1/events",json=assignment);print("Assignment:",response.status_code,response.json())
