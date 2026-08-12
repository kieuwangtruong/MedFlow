# Routing Agent handoff

Wait-Time Module không chọn phòng. Agent phải giữ quyết định cuối cùng và retry bằng requote khi state đổi.

## 1. Quote candidate rooms

```json
{
  "request_id": "REQ-001",
  "patient_token": "PATIENT-ALIAS",
  "task_type": "INITIAL_CONSULT",
  "service_code": "CLINICAL_CONSULT",
  "clinical_priority": "NORMAL",
  "ready_at": "2026-08-11T09:00:00+07:00",
  "candidate_room_ids": ["ROOM-A", "ROOM-B", "ROOM-C"],
  "dry_run": true
}
```

Response có `generated_at`, `valid_until`, version tổng snapshot, `estimate_versions` từng room và `options`. Mỗi option có EWT/ETA, assignment impact, reason codes và queue version. Không dùng option sau `valid_until`; bỏ các option `RESOURCE_UNAVAILABLE`/`INVALID_CANDIDATE_ROOM`.

## 2. Commit quyết định ngoài module

```json
{
  "event_id": "EVT-ASSIGN-001",
  "event_time": "2026-08-11T09:00:10+07:00",
  "journey_id": "JOURNEY-001",
  "task_id": "TASK-001",
  "patient_token": "PATIENT-ALIAS",
  "queue_id": "ROOM-B",
  "event_type": "TASK_ASSIGNED_TO_QUEUE",
  "task_type": "INITIAL_CONSULT",
  "clinical_priority": "NORMAL",
  "based_on_estimate_version": 12,
  "metadata": {"service_type": "CLINICAL_CONSULT"}
}
```

## 3. Requote

```json
{
  "detail": {
    "status": "REQUOTE_REQUIRED",
    "current_estimate_version": 13,
    "based_on_estimate_version": 12,
    "reason_code": "STATE_VERSION_CHANGED",
    "next_action": "CALL_ROOM_OPTIONS_AGAIN"
  }
}
```

Khi nhận 409, agent bỏ quyết định dựa trên quote cũ, gọi lại room-options với cùng candidate set đã được nghiệp vụ xác nhận, đánh giá lại và gửi event ID mới.

Client chạy được: `ai/wait_time_module/examples/routing_client.py` và `routing_client.ts`.
