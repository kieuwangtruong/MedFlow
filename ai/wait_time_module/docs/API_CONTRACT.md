# Hợp đồng API

Mọi timestamp là ISO 8601 có offset và được chuẩn hóa về `Asia/Ho_Chi_Minh`. Public API chỉ dùng `patient_token`, không nhận PII. Khi `AUTH_ENABLED=true`, gửi `X-API-Key` có scope phù hợp.

| Phương thức | Endpoint | Scope |
|---|---|---|
| GET | `/health` | công khai |
| POST | `/api/v1/events` | `events.write` |
| GET | `/api/v1/patients/{patient_token}/estimate` | `wait.read` |
| GET | `/api/v1/queues/{queue_id}/estimates` | `wait.read` |
| GET | `/api/v1/journeys/{journey_id}/estimate` | `wait.read` |
| POST | `/api/v1/simulations/scenario` | `simulation.run` |
| GET | `/api/v1/rooms/status` | `wait.read` |
| GET | `/api/v1/queues/{queue_id}/summary` | `wait.read` |
| POST | `/api/v1/estimates/room-options` | `wait.read` |
| POST | `/api/v1/estimates/assignment-impact` | `simulation.run` |

## Room options

```json
{"request_id":"REQ-001","patient_token":"A173","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"NORMAL","ready_at":"2026-07-18T09:20:00+07:00","candidate_room_ids":["ROOM-A","ROOM-B"],"dry_run":true}
```

Mỗi option trả status, `queue_ahead`, `active_resources`, `future_task_count`, EWT P50/P80/P90, operational display band, service duration, ETA start/completion, assignment impact, reason codes và `estimate_version`. Response tuyệt đối không có `selected_room`. Room không tồn tại trả option `INVALID_CANDIDATE_ROOM`; không có resource trả `RESOURCE_UNAVAILABLE` và estimate null.

Request cũ vẫn hợp lệ. Trường mới tùy chọn: `appointment_start`, `appointment_window_start/end`, `physical_arrival_at`, `checkin_at`, `eligible_at`, `presence_status`, `predicted_available_at`, `dependency_task_ids`.

```json
{"eligibility":{"eligible_at":"2026-07-18T09:40:00+07:00","hard_eligible":false,"presence_status":"CHECKED_IN_EARLY"},"wait_breakdown":{"estimated_physical_wait_minutes":160,"estimated_operational_wait_minutes":30,"early_arrival_minutes":150,"backlog_minutes":18}}
```

Nếu service đã bắt đầu, patient estimate dùng `physical_wait_minutes`, `operational_wait_minutes`, `source=ACTUAL`; trước đó chỉ trả `estimated_*`. Room summary thêm `early_checked_in_count`, `physical_waiting_count`, `in_other_service_count`, `backlog_minutes`, `backlog_task_count`.

Event mới: `PATIENT_ARRIVED`, `PATIENT_CHECKED_IN_EARLY`, `TASK_BECAME_ELIGIBLE`, `PATIENT_READY_AT_QUEUE`, `PATIENT_LEFT_FOR_OTHER_SERVICE`, `OTHER_SERVICE_STARTED`, `OTHER_SERVICE_COMPLETED`, `PATIENT_RETURNING_TO_QUEUE`, `PATIENT_RETURNED_TO_QUEUE`, `PATIENT_LOCATION_UPDATED`, `TASK_MISSED_CALL`.

## Assignment/reassignment

```json
{"event_id":"EVT-ASSIGN-001","event_time":"2026-07-18T09:21:00+07:00","event_type":"TASK_ASSIGNED_TO_QUEUE","patient_token":"A173","task_id":"TASK-001","journey_id":"JOURNEY-001","queue_id":"ROOM-B","task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL","based_on_estimate_version":21,"actor_id":"ROUTING-AGENT-01","actor_type":"SERVICE","metadata":{"service_type":"CLINICAL_CONSULT"}}
```

Nếu version hiện tại khác `based_on_estimate_version`, API trả HTTP 409 với `status=REQUOTE_REQUIRED` và current version; event bị từ chối được audit. Duplicate event trả `accepted=false`, `duplicate=true`, kể cả sau restart.

## Lỗi

- HTTP 401: thiếu/sai API key.
- HTTP 403: key thiếu scope.
- HTTP 409: timestamp cũ hoặc cần requote.
- HTTP 422: schema sai, candidate limit vượt cấu hình hoặc room impact không hợp lệ.
- Estimate status: `OK`, `STALE_DATA`, `RESOURCE_UNAVAILABLE`, `INVALID_CANDIDATE_ROOM`, `MODEL_FALLBACK`.
