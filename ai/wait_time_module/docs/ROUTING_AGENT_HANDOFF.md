# Bàn giao cho Routing Agent

## Luồng tích hợp

1. Triage system xác nhận `service_code` và `clinical_priority`.
2. Routing Agent lập `candidate_room_ids` đã lọc điều kiện lâm sàng.
3. Gọi `POST /api/v1/estimates/room-options` với `dry_run=true`.
4. Đọc từng option; module không trả `selected_room`.
5. Routing Agent tự chọn phòng.
6. Gửi `TASK_ASSIGNED_TO_QUEUE` với `based_on_estimate_version` của option.
7. Nếu HTTP 409/`REQUOTE_REQUIRED`, gọi room-options lại rồi quyết định lại.

P50 là median vận hành; P80 dùng làm operational display band; P90 là risk indicator, không gọi P50–P80 là confidence interval. Không dùng option sau `valid_until`. `STALE_DATA` cần refresh/requote; `RESOURCE_UNAVAILABLE` có estimate null và không nên chọn; `INVALID_CANDIDATE_ROOM` cho biết room chưa tồn tại trong state.

Ví dụ chạy được: `examples/routing_client.py` và `examples/routing_client.ts`. Python client cần API đang chạy và room đã được tạo qua resource event. Biến môi trường: `WAIT_TIME_BASE_URL`, `WAIT_TIME_API_KEY`.

Với bệnh nhân đến sớm, gửi appointment/arrival/checkin/eligible/presence; không giả `ready_at` chỉ vì bệnh nhân ở sảnh. Với cross-room, Routing Agent xác nhận có thể song song và cung cấp `predicted_available_at`. Reason codes mới: `EARLY_CHECKIN_NOT_YET_ELIGIBLE`, `IN_OTHER_SERVICE`, `DEPENDENCY_NOT_COMPLETED`, `PREDICTED_RETURN_BEFORE_SLOT`, `PREDICTED_RETURN_AFTER_SLOT`, `PRIOR_WINDOW_BACKLOG`, `PHYSICAL_OCCUPANCY_HIGH`.
