# Hướng dẫn tích hợp

```text
Triage xác nhận priority/service
→ Routing Agent gửi candidate rooms
→ Wait-Time Module trả EWT và impact từng room
→ Routing Agent tự chọn room
→ gửi TASK_ASSIGNED_TO_QUEUE
→ Wait-Time Module transactionally lưu event/task/audit và tăng version
→ queue/EWT được tính lại
```

Routing Agent phải giữ `valid_until` và `estimate_version`. HTTP 409 yêu cầu quote lại. Không retry assignment bằng event ID mới khi chưa biết kết quả; retry cùng `event_id` để tận dụng idempotency.

Hệ thống tài nguyên gửi `RESOURCE_FAILED`/`RESOURCE_AVAILABLE`; service orchestration gửi started/completed; LIS/RIS gửi `RESULT_READY`; routing quay lại gửi `RETURN_STARTED`/`RETURN_ARRIVED`. Priority change phải do actor có quyền nghiệp vụ cung cấp và được audit.

Postman collection ở `postman/`; client mẫu ở `examples/`; smoke test ở `scripts/smoke_test_api.py`. OpenAPI JSON là nguồn schema máy đọc tại `docs/openapi.json`.

Routing Agent quyết định task có thể song song và gửi `predicted_available_at=predicted_completion_at_other+transfer_time`; module không tự tính transfer. Rời A gửi `PATIENT_LEFT_FOR_OTHER_SERVICE`; B xong gửi `OTHER_SERVICE_COMPLETED`; đang quay lại gửi `PATIENT_RETURNING_TO_QUEUE`; chỉ `PATIENT_RETURNED_TO_QUEUE`/`PATIENT_READY_AT_QUEUE` đưa task về hard eligibility.
