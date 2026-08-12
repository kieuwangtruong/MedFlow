# Kiến trúc

```text
HIS/EHR/LIS/RIS → Event API → SQLAlchemy journal + snapshot + audit
                                      ↓
Routing Agent → room-options → Queue Engine → Monte Carlo → EWT từng phòng
                     ↓               ↑
             assignment event   Quantile predictor/fallback
```

Persistence gồm `events`, `queue_tasks`, `resources`, `journey_timestamps`, `state_meta` và `audit_records`. Khi khởi động, Store load snapshot, event ID, version và timestamp ordering metadata. Event mới được ghi cùng snapshot/audit trong transaction. `events.event_id` là unique constraint chống duplicate sau restart.

SQLite phù hợp demo một worker. PostgreSQL bảo vệ transaction/unique constraint ở DB; assignment kiểm tra optimistic `based_on_estimate_version`. Row lock/compare-and-swap liên process theo aggregate queue chưa được triển khai và kiểm chứng với PostgreSQL thật, nên multi-worker assignment vẫn là `PARTIAL`.

Cache estimate dùng khóa `(queue_id, estimate_version, task_id)`. Event làm tăng version nên cache cũ không còn được đọc; GET cùng version không chạy lại Monte Carlo.

Eligibility pipeline tách physical occupancy (`physical_arrival_at`), time eligibility (`eligible_at`) và hard readiness (`ready_at` + presence + dependencies). Chỉ `READY_AT_ROOM`/`ARRIVED_AT_ROOM` vào scheduler. `CHECKED_IN_EARLY` và `IN_OTHER_SERVICE` được giữ trong snapshot/future simulation nhưng không chiếm hard position.

Task snapshot lưu JSON nên schema 3 dùng migration local để normalize dữ liệu cũ bằng Pydantic defaults và lưu version theo queue. Default legacy là `presence_status=READY_AT_ROOM` để giữ tương thích.
