# Hạn chế và trạng thái triển khai

## PARTIAL

- Concurrency trong một process được bảo vệ bằng lock và có test hai thread. PostgreSQL multi-process chưa có row lock/atomic compare-and-swap được xác minh; không tuyên bố an toàn multi-worker.
- Structured logs có request/correlation/latency/status và event/journey/task/queue/version ở event path; chưa có metrics exporter/tracing backend tập trung.
- Frontend có test production mock guard và API config; UI chuyên biệt cho room-options/requote chưa tồn tại nên chưa có toàn bộ test luồng giao diện được yêu cầu.
- Model metrics chỉ dựa trên synthetic holdout; chưa có calibration/shadow data thật.

## CONFIGURED_NOT_DEPLOYED

- PostgreSQL URL, Render manifests, production commands và environment validation có cấu hình nhưng không được deploy trong đợt này.
- Không kiểm thử cloud, Redis, Kubernetes, multi-instance hoặc rollback production.
- Backend cold-start được giảm rủi ro bằng timeout cấu hình 120 giây ở frontend và 90 giây ở backend, chưa có retry/backoff/circuit breaker.

## SYNTHETIC_ONLY / NOT_CLINICALLY_VALIDATED

- Duration model, Monte Carlo assumptions, baseline comparison và data-quality demo đều dùng synthetic data.
- SLA thresholds trong analytics là demo assumptions.
- Không kết quả nào chứng minh hiệu quả lâm sàng, an toàn điều trị hoặc production readiness.

## OUT_OF_SCOPE

Triage, chẩn đoán, quyết định priority, lọc clinical candidates, walking time và chọn phòng cuối cùng thuộc hệ thống/người dùng bên ngoài Wait-Time Module.
