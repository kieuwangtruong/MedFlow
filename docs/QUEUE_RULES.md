# Quy tắc queue

## Eligibility và thứ tự

Hard queue chỉ nhận task có readiness/presence/dependency phù hợp. Thứ tự ưu tiên được kiểm tra theo bucket:

1. `EMERGENCY`
2. `URGENT`
3. normal đang có SLA risk
4. `RETURN_REVIEW` có SLA risk
5. normal với aging

Priority là input từ hệ thống/người có quyền; Wait-Time Module không triage hay tự suy luận priority.

## Multi-resource

Scheduler dùng resource khả dụng sớm nhất, kiểm tra compatible service types, loại resource `FAILED`, và không preempt task đang phục vụ. Scheduled task chưa ready không làm resource idle nếu còn task eligible khác.

## Future workload và return

`RESULT_PENDING`, task đang ở service khác và scheduled task tương lai không giữ hard position. Chúng có thể tham gia Monte Carlo như future workload với uncertainty được cấu hình. Return review chỉ hard-eligible khi actual result ready và actual return arrived đều có mặt.

## No-show và failure

No-show có grace period sau missed call và bị suppress khi bệnh nhân đang ở service khác. Resource failure/available, no-show và override đều là event làm state/version thay đổi và được audit. Scenario tương ứng chỉ là dry-run.

## Estimate interpretation

P50 là median, P80 là operational display/risk band, P90 là tail-risk indicator. Đây không phải confidence interval và không phải cam kết SLA.
