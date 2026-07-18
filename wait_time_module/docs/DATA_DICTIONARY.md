# Từ điển dữ liệu

- `candidate_room_ids`: phòng đã được Routing Agent lọc điều kiện lâm sàng.
- `ready_at`: thời điểm task có thể được phục vụ.
- `future_task_count`: số `RESULT_PENDING` có thể trở thành workload tương lai.
- `assignment_impact`: delta EWT của người đang chờ khi thêm bệnh nhân.
- `estimate_version`: phiên bản state dùng để tạo quote.
- `based_on_estimate_version`: version Routing Agent dùng khi assignment.
- `sla_breach_count`: số task chuyển từ trong SLA sang vượt SLA do assignment.
- `estimated_result_ready_at`, `estimated_return_arrived_at`: timestamp dự báo, không phải actual.
- `actual_result_ready_at`, `actual_return_arrived_at`: timestamp nhận từ event thực tế.
- `ready_for_review_at`: `max(actual_result_ready_at, actual_return_arrived_at)`.
- `model_version`: mã phiên bản artifact theo thời điểm train UTC.
- `training_data_type`: hiện là `SYNTHETIC`.
- `feature_schema_version`: phiên bản schema; artifact sai version bị từ chối và fallback.

Ba duration tách biệt: `active_service_duration`, `interruption_duration`, `elapsed_service_duration`. Target ML là active duration. Feature outcome/timestamp sau phục vụ bị loại để tránh leakage.

Audit gồm `audit_id`, `event_id`, `entity_type`, `entity_id`, `action`, `previous_value`, `new_value`, `reason_code`, `actor_id`, `actor_type`, `created_at`, `correlation_id`.

Early/cross-room: `appointment_start`, `appointment_window_start/end`, `physical_arrival_at`, `checkin_at`, `eligible_at`, `ready_at`, `presence_status`, `current_location`, `current_task_id`, `predicted_available_at`, `actual_available_at`, `dependency_task_ids`. Legacy task mặc định `presence_status=READY_AT_ROOM`.

`physical_waiting_count` là occupancy; `waiting_ready_count` là hard queue; `backlog_minutes` là remaining duration của eligible unfinished task thuộc window trước. Ba đại lượng này không thay thế nhau.
