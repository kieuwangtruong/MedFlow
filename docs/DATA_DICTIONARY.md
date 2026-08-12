# Data dictionary

## Operational state

| Entity/table | Grain | Trường chính | Ghi chú |
| --- | --- | --- | --- |
| `events` | một event bất biến | `event_id`, `event_time`, payload | `event_id` unique, idempotency qua restart |
| `queue_tasks` | một task | `task_id`, `queue_id`, payload, version | Snapshot Pydantic JSON |
| `resources` | một doctor/device | `resource_id`, `queue_id`, status, payload | `FAILED` không nhận task mới |
| `journey_timestamps` | một journey | `journey_id`, payload | Actual/estimated giữ provenance riêng |
| `state_meta` | một key | `version`, `queue_versions`, timestamps | Schema local version 3 |
| `audit_records` | một quyết định/thay đổi | entity, action, before/after, reason, actor | Actor lấy từ principal xác thực |

## Queue task semantics

- `physical_arrival_at`: có mặt tại bệnh viện; không đồng nghĩa eligible.
- `eligible_at`: sớm nhất có thể xét vào queue.
- `ready_at`: đã sẵn sàng cho service/room.
- `presence_status`: vị trí/trạng thái hiện diện, tách khỏi readiness.
- `RESULT_PENDING`: future workload, không giữ hard position/resource.
- `ready_for_review_at = max(actual_result_ready_at, actual_return_arrived_at)` khi cả hai actual có mặt.
- `estimate_version`: version queue của estimate cụ thể; room-options còn trả version tổng snapshot dùng để commit assignment.

## Analytics privacy

Output analytics chỉ cho phép `patient_alias` là SHA-256 rút gọn. Raw `patient_token` bị coi là critical data-quality failure. Dataset/report hiện tại là synthetic, không đại diện dữ liệu bệnh viện thật.
