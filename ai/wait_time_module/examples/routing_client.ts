const baseUrl = process.env.WAIT_TIME_BASE_URL ?? "http://127.0.0.1:8000";
const headers: Record<string, string> = {"Content-Type": "application/json"};
if (process.env.WAIT_TIME_API_KEY) headers["X-API-Key"] = process.env.WAIT_TIME_API_KEY;
const now = new Date().toISOString();
const body = {request_id:"REQ-TS-001",patient_token:"A173",task_type:"INITIAL_CONSULT",service_code:"CLINICAL_CONSULT",clinical_priority:"NORMAL",ready_at:now,physical_arrival_at:now,presence_status:"READY_AT_ROOM",dependency_task_ids:[],candidate_room_ids:["ROOM-A","ROOM-B"],dry_run:true};
const response = await fetch(`${baseUrl}/api/v1/estimates/room-options`,{method:"POST",headers,body:JSON.stringify(body)});
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
const quote = await response.json();
console.log(quote); // Routing Agent tự chọn room; Wait-Time Module không trả selected_room.
