# Báo cáo xác minh và hardening MedFlow — 11/08/2026

## Tóm tắt kỹ thuật

Luồng Wait-Time/queue assignment hiện ở trạng thái **IMPLEMENTED + VERIFIED LOCAL** cho SQLite, một process/một Uvicorn worker. `room-options` và `assignment-impact` là dry-run; assignment/reassignment chỉ mutation qua event; state, idempotency, queue version và audit sống qua restart; stale quote trả 409; concurrency hai thread chỉ chấp nhận một assignment. Backend → AI health contract, OpenAPI và smoke API thật đã qua kiểm thử.

Tổng cộng **81 test pass, 0 fail, 0 skip** trên năm suite được phát hiện và chạy. Frontend lint/build và backend lint đều đạt. Data-quality demo đi từ **1/24 check fail, 5 record high-severity** xuống **0/26 check fail, 0 critical/high** sau khi sửa synthetic journey generator. Model load thành công, không fallback; mọi model/analytics metric vẫn là **SYNTHETIC_ONLY** và **NOT_CLINICALLY_VALIDATED**.

Không tuyên bố production-ready. Concurrency PostgreSQL đa process, Alembic production migration, full frontend room-option/requote UI tests, cloud deployment và test cho `peak_hour_prediction` còn **PARTIAL/MISSING**.

## 1. Baseline trước khi sửa

| Hạng mục | Bằng chứng baseline | Trạng thái |
| --- | --- | --- |
| Wait-Time tests | 46 pass, 0 fail; 1 Starlette warning | Có suite chạy được |
| Routing tests | Collection lỗi do thiếu `pydantic-settings` | BLOCKED dependency |
| Analytics tests | Collection lỗi do thiếu `PyYAML` | BLOCKED dependency |
| Backend | `node_modules` hỏng/thiếu Prisma client sau lỗi tar/npm | BLOCKED dependency |
| Frontend | lockfile lệch dependency `@emnapi/*`; `npm ci` lỗi | BLOCKED dependency |
| Data quality | 136 rows, 24 checks, 1 check fail, 5 high failures | PARTIAL |
| OpenAPI/smoke | Artifact có sẵn nhưng chưa được chạy lại trong phiên | IMPLEMENTED_NOT_VERIFIED |

Môi trường cuối dùng Python 3.12.10; các version quan trọng được đồng bộ với artifact: Pydantic 2.11.7, NumPy 2.1.3, scikit-learn 1.5.2 và joblib 1.4.2. `pip check` trả `No broken requirements found`.

## 2. Gap matrix ban đầu

| Capability | Trạng thái ban đầu | Khoảng cách chính | Trạng thái sau |
| --- | --- | --- | --- |
| Room options ba candidate, không `selected_room` | IMPLEMENTED_AND_VERIFIED | Thiếu metadata/version contract đầy đủ | IMPLEMENTED_AND_VERIFIED |
| Assignment impact | IMPLEMENTED_AND_VERIFIED | Chưa assert toàn bộ state không đổi | IMPLEMENTED_AND_VERIFIED |
| Assignment/reassignment | PARTIAL | Chưa chứng minh cả queue cũ/mới tăng version | IMPLEMENTED_AND_VERIFIED local |
| Restart/idempotency/audit | PARTIAL | Per-queue version, override và actor trust chưa đủ | IMPLEMENTED_AND_VERIFIED local |
| Estimate version/requote | PARTIAL | Response 409 thiếu based-on/reason/next action | IMPLEMENTED_AND_VERIFIED local |
| Concurrent assignment | MISSING | Không có test cạnh tranh | VERIFIED cùng process; PARTIAL đa process |
| Result pending/return/multi-resource | IMPLEMENTED_AND_VERIFIED | Thiếu đối chiếu một số priority/SLA bucket | IMPLEMENTED_AND_VERIFIED local |
| Model governance/fallback | PARTIAL | Metadata/segment metrics/fallback rate chưa đủ | IMPLEMENTED_AND_VERIFIED synthetic |
| Health/logging | PARTIAL | Chỉ có health tổng; log thiếu context | IMPLEMENTED_AND_VERIFIED local, monitoring PARTIAL |
| Data quality | PARTIAL | Generator tạo 5 journey >24h; thiếu privacy/dependency checks | IMPLEMENTED_AND_VERIFIED synthetic |
| Frontend high-risk tests | MISSING | Không có test runner/suite | PARTIAL: production mock/API config verified |
| PostgreSQL production concurrency | PARTIAL | Chưa row-lock/CAS liên process, chưa server test | PARTIAL/BLOCKED external DB |

## 3. Kiến trúc sau khi sửa

Triage/nghiệp vụ xác nhận service và priority → Routing Agent gửi candidate rooms → Wait-Time trả quote/impact dry-run → Agent chọn phòng bên ngoài module → event assignment commit state → event journal/snapshot/audit/version được ghi → estimate cache theo queue version buộc EWT được tính lại. Kiến trúc chi tiết ở [ARCHITECTURE.md](ARCHITECTURE.md).

Store dùng `RLock` để gói check-version và apply-event trong một critical section nội process. DB transaction ghi event, snapshots, meta và audit. Đây chưa phải atomic compare-and-swap liên process trên PostgreSQL.

## 4. Danh sách file tạo/sửa

Các thay đổi hardening chính:

- Core Wait-Time: `app/main.py`, `domain/models.py`, `services/events.py`, `storage/memory.py`, `storage/migrations.py`, `queue_engine/engine.py`, `ml/predictor.py`, `schemas/api.py`.
- Tests: `test_hardening_contract.py`, `test_synthetic_data_quality.py`, cập nhật persistence/system migration tests.
- Model/data: synthetic generator, train script, model metadata/metrics/baseline, sample CSV và quality JSON.
- Analytics: `data_quality.py`, test mới, report builder và output/report được tái tạo.
- Backend/frontend: AI health gateway contract test, patient route test, production mock guard, API config test, lockfile.
- Tài liệu: bộ `docs/` cấp repository, tài liệu module và OpenAPI JSON.

Dirty worktree có trước khi sửa đã được giữ nguyên, gồm các thay đổi của người dùng ở deployment/root README/env/backend AI client/frontend auth/symptom files, `render.yaml`, file Word untracked và patient route test. Không reset, checkout, commit hay deploy.

## 5. Database schema và migration

SQLite/PostgreSQL schema tối thiểu gồm `events`, `queue_tasks`, `resources`, `journey_timestamps`, `state_meta`, `audit_records`. `events.event_id` unique. Local schema marker tăng từ 2 lên 3 và `state_meta.queue_versions` lưu map version theo queue; migration idempotent không xóa snapshot cũ.

Restart test dùng database tạm xác nhận task/event/version/queue versions và estimate được phục hồi. Production vẫn cần Alembic và concurrency migration/locking được kiểm thử trên PostgreSQL thật.

## 6. Endpoint đã xác minh

| Endpoint | Bằng chứng |
| --- | --- |
| `POST /api/v1/estimates/room-options` | 3 candidates, dry-run, quote metadata, không selected room |
| `POST /api/v1/estimates/assignment-impact` | 6 impact fields, state-free |
| `POST /api/v1/events` | assignment/reassignment/idempotency/audit/requote |
| `GET /api/v1/patients/{token}/estimate` | estimate/status/version |
| `GET /api/v1/queues/{id}/estimates` | queue EWT |
| `GET /api/v1/queues/{id}/summary` | room/load/version |
| `GET /api/v1/journeys/{id}/estimate` | actual timestamps và return review |
| `GET /api/v1/rooms/status` | room/resource state |
| `POST /api/v1/simulations/scenario` | dry-run không mutation |
| `/health/live`, `/health/ready`, `/health/version` | health contract test + smoke |

OpenAPI cuối có 13 paths; có room-options và assignment-impact; số lần xuất hiện `selected_room` là 0.

## 7. Ví dụ `room-options`

Request thực tế dùng trong contract run:

```json
{"request_id":"REQ-REPORT","patient_token":"PATIENT-ALIAS","task_type":"INITIAL_CONSULT","service_code":"CLINICAL_CONSULT","clinical_priority":"URGENT","ready_at":"2026-08-11T09:00:00+07:00","candidate_room_ids":["ROOM-A","ROOM-B"],"dry_run":true}
```

Response thực tế có `estimate_version=0`, `estimate_versions={"ROOM-A":0,"ROOM-B":0}`, `dry_run=true`, hai options, `selected_room` không tồn tại. ROOM-A có một task thường bị ảnh hưởng; option urgent trả `affected_patients=1`, `average_added_wait_minutes=11.87`, `room_load_before=10.0`, `room_load_after=21.87`.

## 8. Ví dụ `assignment-impact`

Contract run với ROOM-A và `predicted_minutes=12` trả:

```json
{"room_id":"ROOM-A","dry_run":true,"assignment_impact":{"affected_patients":1,"average_added_wait_minutes":12.0,"max_added_wait_minutes":12.0,"sla_breach_count":0,"room_load_before":10.0,"room_load_after":22.0},"estimate_version":0}
```

State trước/sau: version 0, event 0, task 1, audit 0 — không đổi.

## 9. Ví dụ assignment event

```json
{"event_id":"EVT-ASSIGN-001","event_time":"2026-08-11T09:00:10+07:00","journey_id":"JOURNEY-001","task_id":"TASK-001","patient_token":"PATIENT-ALIAS","queue_id":"ROOM-B","event_type":"TASK_ASSIGNED_TO_QUEUE","task_type":"INITIAL_CONSULT","clinical_priority":"NORMAL","based_on_estimate_version":12,"metadata":{"service_type":"CLINICAL_CONSULT"}}
```

Actor ghi audit được lấy từ API key/principal; `actor_id` trong body không được tin cậy.

## 10. Ví dụ requote

```json
{"detail":{"status":"REQUOTE_REQUIRED","current_estimate_version":13,"based_on_estimate_version":12,"reason_code":"STATE_VERSION_CHANGED","next_action":"CALL_ROOM_OPTIONS_AGAIN","message":"REQUOTE_REQUIRED: current estimate_version is 13"}}
```

HTTP 409 không mutation queue và ghi `ASSIGNMENT_REJECTED` audit. Routing Agent phải gọi lại room-options và tạo event ID mới nếu quyết định lại.

## 11. Restart persistence

Test database tạm thực hiện create store → assignment → lấy estimate → tạo Store mới cùng URL. Store mới phục hồi task ở ROOM-A, global version 1, queue version `ROOM-A=1`; estimate payload trước/sau nhất quán khi không có event mới. Journey/resource state cũng được test trong suite hiện hữu.

## 12. Idempotency sau restart

Gửi lại cùng `event_id` trên Store phục hồi trả `False`/`duplicate=true`; global và queue version không tăng, không tạo task/event/audit lần hai. Unique event ID ở DB là lớp bảo vệ bổ sung.

## 13. Concurrent assignment

Hai thread gửi hai assignment khác room nhưng cùng `based_on_estimate_version=0`: đúng một event được accept, một event nhận `REQUOTE_REQUIRED`; state có một task, một event và version 1. **Giới hạn:** bằng chứng này chỉ cho cùng process. Multi-process PostgreSQL là PARTIAL.

## 14. Data quality trước và sau

| Chỉ tiêu | Trước | Sau |
| --- | ---: | ---: |
| Rows | 136 | 20 |
| Columns | 62 | 61 |
| Checks | 24 | 26 |
| Failed checks | 1 | 0 |
| Critical/high affected records | 5 | 0 |

Check lỗi trước là `journey duration above 24 hours`: 5/136 records (3.68%), severity high. Nguyên nhân là generator chọn mốc thời gian độc lập cho từng step nên một visit có thể bị ghép qua ngày. Sửa bằng shared visit base + sequential offsets và tái tạo sample 20 rows/5 journeys. Lỗi làm méo journey completion/average và báo cáo KPI journey; không dùng làm training set 10k của duration model nên không trực tiếp thay đổi model artifact.

Checks mới bao gồm duplicate event (ghi rõ chưa đánh giá nếu extract task không có event ID), missing journey/ready/queue, invalid readiness, service thiếu resource, collision actual/estimated, cyclic dependency và patient alias không đúng SHA-256 rút gọn.

## 15. Model và baseline metrics

Artifact load cuối: `using_fallback=false`, `load_error=null`; prediction smoke CLINICAL_CONSULT trả P50 11.872, P80 12.499, P90 12.916 phút.

| Metric synthetic holdout | Giá trị |
| --- | ---: |
| P50 MAE | 0.7196 |
| P50 RMSE | 0.9109 |
| Baseline MAE | 2.5002 |
| P50/P80/P90 coverage | 49.73% / 79.40% / 89.87% |
| Training rows | 7,000 |
| Validation/Test rows | 1,500 / 1,500 |

P50 MAE theo service: 0.620–0.802; theo priority: 0.653–0.724. Metadata ghi `training_data_type=SYNTHETIC`, `clinically_validated=false`, model/feature schema version và trained timestamp.

Baseline simulation 30 lần: Queue Engine + Routing median wait 101.434 phút và SLA breach 0.779; FCFS là 115.687 và 0.798. P80/P90 không cải thiện trong workload synthetic này, nên không diễn giải như uplift production.

## 16. Test pass/fail/skip theo service

| Suite | Pass | Fail | Skip | Ghi chú |
| --- | ---: | ---: | ---: | --- |
| Wait-Time Engine | 57 | 0 | 0 | 1 Starlette/httpx deprecation warning |
| Routing (`process_input_data`) | 4 | 0 | 0 | Artifact sklearn version đã đồng bộ |
| Analytics | 8 | 0 | 0 | Gồm baseline, metrics, data quality |
| Backend Node | 8 | 0 | 0 | Gồm Prisma và backend→AI contract |
| Frontend Node | 4 | 0 | 0 | API config + production mock guard |
| **Tổng** | **81** | **0** | **0** | Lint backend/frontend và frontend build cũng đạt |

Unified AI app không có suite riêng; TestClient smoke trả health 200 và 18 unified OpenAPI paths. `peak_hour_prediction` không có test file được phát hiện, nên là IMPLEMENTED_NOT_VERIFIED.

## 17. Monte Carlo latency

Benchmark Windows local, 30 iterations × 300 runs, 25 tasks, 2 resources: **p50 238.70 ms, p95 275.30 ms, max 299.57 ms**. Đây là benchmark development trên một máy, không phải production SLO.

## 18. Local smoke test

Uvicorn một worker chạy tạm trên `127.0.0.1:8765`, SQLite local; script trả health ok, OpenAPI 13 paths, rooms 0. Process được dừng sau test. Backend integration test xác nhận `/api/v1/ai/health` gọi đúng AI `/health/live`.

Secret scan repository cuối đạt trên 437 files; `gitleaks` không cài, nhưng script dự án che giá trị và kiểm tra private key/GitHub/AWS/Google/OpenAI-style key, credential URL và hard-coded secrets.

## 19. Chỉ cấu hình, chưa deploy

Render manifests, env validation, production start/migration commands, PostgreSQL URL và health checks đã có/cập nhật nhưng không được triển khai. Không credential thật nào được dùng. Không chạy cloud, Redis, Kubernetes, multi-instance, production rollback hay external smoke.

## 20. Hạn chế còn lại

- BLOCKED/PARTIAL: PostgreSQL multi-process optimistic concurrency/row locking chưa triển khai và chưa có server để test.
- PARTIAL: frontend chưa có UI contract riêng cho room-options/requote/resource unavailable/assignment success; chỉ production mock/API deployment guards được test.
- MISSING: test suite cho `peak_hour_prediction`.
- PARTIAL: structured logs chưa nối metrics/tracing backend; chưa SSE, hiện integration dựa REST/polling ở các màn hình hiện hữu.
- SYNTHETIC_ONLY: model, Monte Carlo assumptions, analytics và SLA demo.
- NOT_CLINICALLY_VALIDATED và không production-ready.
- Local schema migration chưa phải Alembic production migration.

## 21. `git status --short`

Worktree vẫn dirty có chủ đích, gồm cả thay đổi người dùng có trước và thay đổi hardening. Snapshot đầy đủ được chụp ở cuối phiên; các nhóm chính là 50 tracked files modified và các untracked: báo cáo Word của người dùng, quality JSON/test mới, backend integration tests, `docs/`, frontend API config/tests. Không file nào được stage hoặc commit.

```text
 M DEPLOYMENT.md
 M README.md
 M RENDER_ENV_VARS.md
 M ai/wait_time_module/README.md
 M ai/wait_time_module/app/domain/models.py
 M ai/wait_time_module/app/main.py
 M ai/wait_time_module/app/ml/predictor.py
 M ai/wait_time_module/app/queue_engine/engine.py
 M ai/wait_time_module/app/schemas/api.py
 M ai/wait_time_module/app/services/events.py
 M ai/wait_time_module/app/storage/memory.py
 M ai/wait_time_module/app/storage/migrations.py
 M ai/wait_time_module/artifacts/baseline.json
 M ai/wait_time_module/artifacts/metrics.json
 M ai/wait_time_module/artifacts/training_metadata.json
 M ai/wait_time_module/data/examples/sample_20.csv
 M ai/wait_time_module/data/sample/synthetic.quality.json
 M ai/wait_time_module/docs/API_CONTRACT.md
 M ai/wait_time_module/docs/ARCHITECTURE.md
 M ai/wait_time_module/docs/LIMITATIONS.md
 M ai/wait_time_module/docs/ROUTING_AGENT_HANDOFF.md
 M ai/wait_time_module/docs/openapi.json
 M ai/wait_time_module/scripts/generate_synthetic_data.py
 M ai/wait_time_module/scripts/train_models.py
 M ai/wait_time_module/tests/test_early_arrival_cross_room.py
 M ai/wait_time_module/tests/test_persistence_routing.py
 M analytics/README.md
 M analytics/outputs/data_quality_checks.csv
 M analytics/outputs/data_quality_summary.json
 M analytics/outputs/task_fact.csv
 M analytics/reports/DA_REPORT.html
 M analytics/reports/DA_REPORT.md
 M analytics/reports/figures/baseline_comparison.png
 M analytics/reports/figures/room_p90.png
 M analytics/scripts/build_report.py
 M analytics/src/data_quality.py
 M backend/.env.example
 M backend/package.json
 M backend/src/config/env.js
 M backend/src/modules/ai-gateway/ai-client.js
 M backend/src/modules/ai-gateway/ai-gateway.controller.js
 M frontend/.env.example
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/api/aiApi.ts
 M frontend/src/api/authApi.ts
 M frontend/src/api/axiosClient.ts
 M frontend/src/pages/auth/LoginPage.tsx
 M frontend/src/pages/patient/SymptomPage.tsx
 M render.yaml
?? BAO_CAO_TONG_HOP_TIEN_DO_MEDFLOW.docx
?? ai/wait_time_module/data/examples/sample_20.quality.json
?? ai/wait_time_module/tests/test_hardening_contract.py
?? ai/wait_time_module/tests/test_synthetic_data_quality.py
?? analytics/tests/test_data_quality.py
?? backend/test/ai-gateway-integration.test.js
?? backend/test/patient-routes.test.js
?? docs/
?? frontend/src/api/apiConfig.ts
?? frontend/test/
```

## 22. Lệnh Git đề xuất để review và commit

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru
git diff --check
git status --short
git diff -- docs ai/wait_time_module analytics backend frontend README.md

# Chỉ sau khi review; thêm đường dẫn tường minh để tránh cuốn file Word/user changes ngoài ý muốn.
git add docs README.md ai/wait_time_module analytics backend/src/modules/ai-gateway backend/test frontend/src/api frontend/test frontend/package.json frontend/package-lock.json
git status --short
git commit -m "harden queue assignment persistence and verification"
```

Không nên dùng `git add -A` khi chưa quyết định có đưa `BAO_CAO_TONG_HOP_TIEN_DO_MEDFLOW.docx` và các thay đổi deployment/auth có trước vào cùng commit hay không.

## Kết luận và bước tiếp theo

Repository sẵn sàng để người dùng review và chia commit cho demo local một worker. Bước kỹ thuật ưu tiên tiếp theo là triển khai compare-and-swap/row lock theo queue trên PostgreSQL và viết integration test hai process; sau đó hoàn thiện frontend room-option/requote UI tests và shadow evaluation trên dữ liệu bệnh viện đã khử định danh.
