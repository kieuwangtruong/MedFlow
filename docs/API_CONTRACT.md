# API contract tích hợp

OpenAPI có thẩm quyền nằm tại `ai/wait_time_module/docs/openapi.json`. Timestamp dùng ISO 8601 có timezone. Public identifiers chỉ dùng token/alias, không dùng PII.

| Method | Endpoint | Tác dụng |
| --- | --- | --- |
| `GET` | `/health/live` | Liveness |
| `GET` | `/health/ready` | DB, schema, queue engine, model/fallback |
| `GET` | `/health/version` | Service, schema và model metadata |
| `POST` | `/api/v1/estimates/room-options` | Dry-run nhiều candidate rooms |
| `POST` | `/api/v1/estimates/assignment-impact` | Dry-run tác động assignment |
| `POST` | `/api/v1/events` | Mutation duy nhất qua event |
| `GET` | `/api/v1/patients/{patient_token}/estimate` | EWT task đang hoạt động |
| `GET` | `/api/v1/queues/{queue_id}/estimates` | EWT các task eligible |
| `GET` | `/api/v1/queues/{queue_id}/summary` | Load/backlog/version một queue |
| `GET` | `/api/v1/journeys/{journey_id}/estimate` | Journey và return review |
| `GET` | `/api/v1/rooms/status` | Trạng thái các phòng |
| `POST` | `/api/v1/simulations/scenario` | Dry-run scenario |

## Quy tắc bắt buộc

- `room-options` và `assignment-impact` chỉ nhận `dry_run=true`; `false` trả 422.
- Dry-run không ghi task/event/audit và không tăng version.
- Không endpoint định giá nào trả `selected_room`.
- Assignment/reassignment chỉ xảy ra qua event tương ứng.
- Duplicate `event_id` trả `accepted=false`, `duplicate=true`.
- Stale assignment trả HTTP 409 với `status`, current/based-on version, `reason_code` và `next_action`.
- Khi bật auth, `X-API-Key` quyết định actor và scopes. Actor trong body bị ghi đè.

Ví dụ request/response đầy đủ nằm trong [ROUTING_AGENT_HANDOFF.md](ROUTING_AGENT_HANDOFF.md).
