"""Demo HTTP local: early arrival và cross-room. API phải được khởi động trước."""
import argparse,os,sys
from datetime import datetime,timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo
import httpx

TZ=ZoneInfo("Asia/Ho_Chi_Minh")
if hasattr(sys.stdout,"reconfigure"):sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr,"reconfigure"):sys.stderr.reconfigure(encoding="utf-8")
def main():
    p=argparse.ArgumentParser();p.add_argument("--base-url",default="http://127.0.0.1:8000");p.add_argument("--api-key",default=os.getenv("WAIT_TIME_API_KEY"));a=p.parse_args();headers={"X-API-Key":a.api_key} if a.api_key else {};prefix=uuid4().hex[:8]
    with httpx.Client(base_url=a.base_url,headers=headers,timeout=30) as client:
        def post(path,payload):
            response=client.post(path,json=payload);assert response.status_code==200,f"{path}: {response.status_code} {response.text}";return response.json()
        def send(event_id,event_time,event_type,task_id,queue_id,metadata=None,resource_id=None):
            payload={"event_id":f"{prefix}-{event_id}","event_time":event_time.isoformat(),"event_type":event_type,"patient_token":f"P-{task_id}","task_id":f"{prefix}-{task_id}","journey_id":f"{prefix}-J-{task_id}","queue_id":queue_id,"task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL","actor_id":"LOCAL-DEMO","actor_type":"SERVICE","metadata":metadata or {}}
            if resource_id:payload["resource_id"]=resource_id
            return post("/api/v1/events",payload)
        def resource(room):send(f"RESOURCE-{room}",datetime.now(TZ),"RESOURCE_AVAILABLE",f"RESOURCE-TASK-{room}",room,{"current_location":room},f"DOCTOR-{room}")
        print("=== Scenario A: bệnh nhân đến quá sớm ===")
        room=f"ROOM-EARLY-{prefix}";resource(room);today=datetime.now(TZ).date();appointment=datetime.combine(today,datetime.min.time(),TZ).replace(hour=10);arrival=appointment-timedelta(minutes=150);eligible=appointment-timedelta(minutes=20)
        send("READY-ONTIME",eligible-timedelta(minutes=5),"PATIENT_READY_AT_QUEUE","ONTIME",room,{"ready_at":(eligible-timedelta(minutes=5)).isoformat(),"physical_arrival_at":(eligible-timedelta(minutes=10)).isoformat(),"presence_status":"READY_AT_ROOM"})
        send("EARLY-CHECKIN",arrival,"PATIENT_CHECKED_IN_EARLY","EARLY",room,{"appointment_start":appointment.isoformat(),"appointment_window_start":appointment.isoformat(),"appointment_window_end":(appointment+timedelta(minutes=30)).isoformat(),"physical_arrival_at":arrival.isoformat(),"presence_status":"CHECKED_IN_EARLY"})
        summary=client.get(f"/api/v1/queues/{room}/summary");assert summary.status_code==200;summary=summary.json();assert summary["early_checked_in_count"]==1 and summary["waiting_ready_count"]==1 and summary["physical_waiting_count"]>=2
        quote=post("/api/v1/estimates/room-options",{"request_id":f"{prefix}-EARLY-QUOTE","patient_token":"P-EARLY","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","appointment_start":appointment.isoformat(),"physical_arrival_at":arrival.isoformat(),"checkin_at":arrival.isoformat(),"eligible_at":eligible.isoformat(),"ready_at":eligible.isoformat(),"presence_status":"CHECKED_IN_EARLY","candidate_room_ids":[room],"dry_run":True})["options"][0]
        assert quote["eligibility"]["eligible_at"].startswith(eligible.isoformat()[:16]) and quote["eligibility"]["hard_eligible"] is False;assert abs(quote["wait_breakdown"]["early_arrival_minutes"]-150)<1
        print(f"Check-in OK; eligible_at={quote['eligibility']['eligible_at']}; early={quote['wait_breakdown']['early_arrival_minutes']} phút")
        print(f"Occupancy={summary['physical_waiting_count']}; ready queue={summary['waiting_ready_count']}; physical/operational={quote['wait_breakdown']['estimated_physical_wait_minutes']}/{quote['wait_breakdown']['estimated_operational_wait_minutes']} phút")
        send("BECAME-ELIGIBLE",eligible,"TASK_BECAME_ELIGIBLE","EARLY",room);still=client.get(f"/api/v1/queues/{room}/summary").json();assert still["waiting_ready_count"]==1
        send("READY-AT-ROOM",eligible,"PATIENT_READY_AT_QUEUE","EARLY",room,{"ready_at":eligible.isoformat()});after=client.get(f"/api/v1/queues/{room}/summary").json();assert after["waiting_ready_count"]==2
        print("Qua eligible_at vẫn cần presence; sau READY_AT_QUEUE task mới vào hard queue.")

        print("=== Scenario B: phòng A chậm, tranh thủ phòng B nhanh ===")
        room_a=f"ROOM-SLOW-A-{prefix}";room_b=f"ROOM-FAST-B-{prefix}";resource(room_a);resource(room_b);now=datetime.now(TZ)-timedelta(seconds=10)
        send("A-TASK-READY",now,"PATIENT_READY_AT_QUEUE","A-TASK",room_a,{"ready_at":now.isoformat(),"physical_arrival_at":now.isoformat()});send("A-OTHER-READY",now,"PATIENT_READY_AT_QUEUE","A-OTHER",room_a,{"ready_at":now.isoformat()})
        before=client.get(f"/api/v1/queues/{room_a}/summary").json();send("LEFT-A",now+timedelta(seconds=1),"PATIENT_LEFT_FOR_OTHER_SERVICE","A-TASK",room_a,{"destination_task_id":f"{prefix}-B-TASK","destination_queue_id":room_b,"predicted_available_at":(now+timedelta(minutes=15)).isoformat()})
        away=client.get(f"/api/v1/queues/{room_a}/summary").json();assert away["waiting_ready_count"]==before["waiting_ready_count"]-1 and away["future_task_count"]>=1 and away["in_other_service_count"]==1
        send("MISSED-NOT-NOSHOW",now+timedelta(seconds=2),"NO_SHOW_CONFIRMED","A-TASK",room_a);patient=client.get(f"/api/v1/patients/P-A-TASK/estimate");assert patient.status_code==200 and patient.json()["readiness_status"]!="NO_SHOW_HOLD"
        version_away=away["estimate_version"];send("B-COMPLETED",now+timedelta(seconds=3),"OTHER_SERVICE_COMPLETED","A-TASK",room_a);returning=client.get(f"/api/v1/queues/{room_a}/summary").json();assert returning["estimate_version"]>version_away and returning["waiting_ready_count"]==1
        send("RETURNED-A",now+timedelta(seconds=4),"PATIENT_RETURNED_TO_QUEUE","A-TASK",room_a);returned=client.get(f"/api/v1/queues/{room_a}/summary").json();assert returned["waiting_ready_count"]==2 and returned["in_other_service_count"]==0
        print(f"Ở B: ready={away['waiting_ready_count']}, future={away['future_task_count']}, no-show=false")
        print(f"B hoàn thành: estimate_version {version_away} → {returning['estimate_version']}; quay lại A: ready={returned['waiting_ready_count']}")
        duplicate=send("RETURNED-A",now+timedelta(seconds=4),"PATIENT_RETURNED_TO_QUEUE","A-TASK",room_a);assert duplicate["duplicate"] is True
        print("Duplicate event idempotent. Restart persistence được kiểm thử tự động trong pytest.")
        print("DEMO PASS")
if __name__=="__main__":
    try:main()
    except Exception as exc:print(f"DEMO FAIL: {exc}",file=sys.stderr);raise
