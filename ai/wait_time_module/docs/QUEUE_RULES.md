# Quy tắc hàng đợi

Task type, priority, readiness và scheduling mode là các enum độc lập. Priority chỉ nhận từ bên ngoài. Thứ tự: EMERGENCY, URGENT, task có nguy cơ SLA (đặc biệt return review), rồi NORMAL theo `ready_at` và `created_seq` (aging). Task đang phục vụ không bị ngắt.

Scheduler dùng min-heap theo thời gian rảnh còn lại, loại resource failed và kiểm tra service compatibility. Scheduled task chưa ready không giữ tài nguyên.

`RESULT_PENDING` không có hard position và không giữ resource, nhưng Monte Carlo chuyển nó thành future return workload bằng distribution riêng cho result ready, return arrival và review duration; vì vậy P80/P90 của task sau có thể tăng.

Normal return dùng `FAIR_QUEUE`, SLA demo `NORMAL_RETURN_REVIEW_SLA_MINUTES=15`, không tự lên đầu. Urgent return dùng `ASAP` và safe slot sau công việc đang phục vụ.

Assignment impact tính `EWT_withP - EWT_withoutP` cho từng task và tổng hợp affected patients, average/max added wait, SLA breach và room load trước/sau.

Hard eligibility yêu cầu `now >= eligible_at`, `ready_at <= now`, dependencies completed và presence `READY_AT_ROOM`/`ARRIVED_AT_ROOM`. Appointment dùng `eligible_at=max(checkin_at, appointment_start-20 phút)` theo demo default. Đến sớm không tạo lợi thế thứ tự.

`physical_wait=service_start-physical_arrival_at`; `operational_wait=service_start-max(eligible_at,ready_at)`. Backlog chỉ tổng remaining duration của task eligible chưa hoàn thành từ window trước, không dùng số người trong sảnh.

`IN_OTHER_SERVICE` không giữ resource/hard position và không bị no-show, nhưng được lấy mẫu như future workload. Missed call chỉ thành no-show sau grace 5 phút hoặc xác nhận nghiệp vụ hợp lệ.
