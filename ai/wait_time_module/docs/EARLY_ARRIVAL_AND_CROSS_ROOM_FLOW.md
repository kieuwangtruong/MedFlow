# Early arrival và cross-room flow

`physical_arrival_at` chỉ cho biết bệnh nhân ở bệnh viện. `eligible_at` là thời điểm sớm nhất được xét; `ready_at` cùng presence xác nhận bệnh nhân thực sự ở phòng. Vì vậy đến sớm tăng physical occupancy nhưng không tăng operational workload hoặc tạo lợi thế queue.

Với appointment, demo dùng `eligible_at=max(checkin_at, appointment_start-DEFAULT_EARLY_CHECKIN_WINDOW_MINUTES)`. Hard queue còn yêu cầu dependencies completed và presence `READY_AT_ROOM`/`ARRIVED_AT_ROOM`.

Backlog là tổng remaining service duration của eligible unfinished task từ window trước. Scheduler vẫn chạy heap đa tài nguyên, không lấy occupancy hoặc queue length nhân average duration.

Task ở phòng khác có presence `IN_OTHER_SERVICE`: không giữ resource, không hard-block, không bị no-show, nhưng Monte Carlo lấy mẫu completion/return và giữ trong `future_task_count`. Chỉ return/ready event mới làm hard eligible.

```mermaid
sequenceDiagram
    participant R as Routing hoặc EHR
    participant W as Wait-Time Module
    R->>W: PATIENT_ARRIVED lúc 07:30
    R->>W: PATIENT_CHECKED_IN_EARLY
    W-->>R: occupancy tăng, hard queue không đổi
    R->>W: room-options, appointment 10:00
    W-->>R: eligible_at 09:40 và hai loại wait
    R->>W: TASK_BECAME_ELIGIBLE
    Note over W: vẫn cần presence tại phòng
    R->>W: PATIENT_READY_AT_QUEUE
    W-->>R: vào hard queue, version tăng
```

```mermaid
sequenceDiagram
    participant R as Routing Agent
    participant A as Queue A
    participant W as Wait-Time Module
    participant B as Service B
    R->>W: PATIENT_LEFT_FOR_OTHER_SERVICE
    W->>A: bỏ hard position, giữ future workload
    B->>W: OTHER_SERVICE_COMPLETED
    W-->>R: version tăng, presence RETURNING
    R->>W: PATIENT_RETURNING_TO_QUEUE
    R->>W: PATIENT_RETURNED_TO_QUEUE
    W->>A: hard eligible và tính lại EWT
```

No-show chỉ được xác nhận khi task đủ điều kiện, không ở service khác, đã missed call và hết grace hoặc có xác nhận nghiệp vụ rõ ràng. Demo chạy bằng `scripts/demo_early_arrival_cross_room.py`.

Giới hạn server: migration hiện là local JSON normalization; cache là in-process; distribution là synthetic; chưa test nhiều worker, PostgreSQL server, Redis hay distributed ordering.
