# Kiến trúc MedFlow sau đợt hardening

Trạng thái: **IMPLEMENTED + VERIFIED LOCAL** cho luồng demo một worker; **CONFIGURED_NOT_DEPLOYED** cho hạ tầng production; model là **SYNTHETIC_ONLY** và **NOT_CLINICALLY_VALIDATED**.

```text
Frontend
   │ REST /api/v1
   ▼
Node/Express backend ── AI gateway ──► Unified FastAPI
                                         ├─ Symptom routing
Routing Agent ─ candidate rooms ─────────┤
                                         └─ Wait-Time & Queue Engine
                                              ├─ event state machine
                                              ├─ scheduler + Monte Carlo
                                              ├─ duration model / median fallback
                                              └─ SQL journal, snapshots, audit
                                                          │
                                                          ▼
                                                     Analytics pipeline
```

## Ranh giới quyết định

Triage/nghiệp vụ xác nhận service và priority. Routing Agent lập danh sách phòng hợp lệ và chọn phòng cuối cùng. Wait-Time Module chỉ định giá từng candidate, mô phỏng tác động và nhận event assignment; response không có `selected_room`.

## Luồng assignment

1. Routing Agent gọi `room-options` ở chế độ dry-run.
2. Module trả P50/P80/P90, ETA, impact, `generated_at`, `valid_until`, version tổng của quote và version từng queue.
3. Agent chọn phòng ở ngoài module và gửi `TASK_ASSIGNED_TO_QUEUE` cùng `based_on_estimate_version`.
4. Store kiểm tra idempotency và optimistic version trong lock nội bộ process.
5. Event, task/resource/journey snapshot, version và audit được lưu; estimate cache dùng version queue nên quote cũ không được tái sử dụng.
6. Nếu state đã đổi, API trả 409 `REQUOTE_REQUIRED` và không assignment.

## Persistence

Các bảng: `events`, `queue_tasks`, `resources`, `journey_timestamps`, `state_meta`, `audit_records`. `events.event_id` là duy nhất. `state_meta` lưu global version, queue-version map, updated timestamp và entity event-time map. Schema local hiện là version 3.

SQLite là cấu hình demo một worker. PostgreSQL URL và transaction được hỗ trợ, nhưng row lock/compare-and-swap liên process chưa được kiểm thử bằng PostgreSQL thật; xem [LIMITATIONS.md](LIMITATIONS.md).
