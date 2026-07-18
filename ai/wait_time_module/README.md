# AI-Native Wait-Time & Queue Engine

Backend FastAPI tính thời gian chờ P50/P80/P90 cho từng phòng, quản lý queue theo event, mô phỏng tác động gán bệnh nhân và cung cấp giao thức ổn định cho Routing Agent. Module nhận service, priority và danh sách phòng ứng viên đã được hệ thống bên ngoài xác nhận; module **không** triage, chẩn đoán, chọn chuyên khoa, tính thời gian đi bộ hoặc trả `selected_room`.

## Thành phần

- Scheduler đa tài nguyên bằng min-heap, có compatibility/busy/failure state.
- Monte Carlo mặc định 300 vòng cho service, result turnaround, emergency interruption và return review.
- `RESULT_PENDING` là future workload, không giữ hard position/resource.
- Journey A → B → quay lại A với timestamp actual/estimated tách riêng.
- Tách physical arrival, eligibility và readiness; bệnh nhân đến sớm không chiếm hard queue.
- Presence riêng cho bệnh nhân đang ở phòng khác; task vẫn tham gia future workload.
- SQLAlchemy persistence: SQLite mặc định, PostgreSQL qua `DATABASE_URL`.
- Event journal, idempotency sau restart, audit và estimate version.
- Service API key với scope `wait.read`, `events.write`, `simulation.run`, `admin.manage`.
- Quantile Gradient Boosting P50/P80/P90 và median fallback. Model hiện train bằng synthetic data, không được xác nhận lâm sàng.

## Cài đặt Windows PowerShell

```powershell
cd <đường-dẫn-repository>\ai\wait_time_module
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
Copy-Item .env.example .env
```

## Cài đặt Linux/macOS

```bash
cd wait_time_module
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e '.[test]'
cp .env.example .env
```

Ứng dụng đọc biến môi trường của process; nạp `.env` bằng công cụ triển khai hoặc shell trước khi chạy.

## Database

Mặc định `DATABASE_URL=sqlite:///./data/wait_time.db`. Khởi tạo schema:

```powershell
.\.venv\Scripts\python.exe scripts\init_db.py
.\.venv\Scripts\python.exe scripts\migrate_local_db.py
```

PostgreSQL dùng URL SQLAlchemy, ví dụ `postgresql+psycopg://user:password@host/db`; cần cài driver `psycopg` ở môi trường triển khai. Schema hiện được tạo bằng SQLAlchemy `create_all`; khi thay đổi schema production nên đưa metadata sang Alembic. SQLite local/demo chỉ nên chạy **một worker**. PostgreSQL dùng transaction và unique constraint cho event ID; optimistic check dùng `estimate_version`.

Migration local schema `2` chuẩn hóa JSON task snapshot cũ và thêm schema marker theo cách idempotent, không xóa database/bảng/dữ liệu. Đây không phải Alembic migration production; `create_all` tự nó không nâng cấp cột bảng cũ.

## Auth

Local mặc định `AUTH_ENABLED=false`. Khi bật, gửi `X-API-Key`; cấu hình key và scope bằng `SERVICE_API_KEYS` dạng JSON. Không commit secret hoặc `.env`.

## Data, model, test và API

```powershell
.\.venv\Scripts\python.exe scripts\generate_synthetic_data.py --rows 10000 --days 45 --seed 42
.\.venv\Scripts\python.exe scripts\train_models.py
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts\export_openapi.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
.\.venv\Scripts\python.exe scripts\smoke_test_api.py
```

Terminal khác chạy demo:

```powershell
.\.venv\Scripts\python.exe scripts\demo_early_arrival_cross_room.py
```

Linux/macOS thay `.\.venv\Scripts\python.exe` bằng `.venv/bin/python`. Import dữ liệu thật đã bỏ PII bằng `scripts/import_real_data.py --input <csv>`.

## Tài liệu

- [Kiến trúc](docs/ARCHITECTURE.md)
- [Hợp đồng API](docs/API_CONTRACT.md)
- [Từ điển dữ liệu](docs/DATA_DICTIONARY.md)
- [Quy tắc hàng đợi](docs/QUEUE_RULES.md)
- [Hướng dẫn tích hợp](docs/INTEGRATION_GUIDE.md)
- [Bàn giao Routing Agent](docs/ROUTING_AGENT_HANDOFF.md)
- [Hạn chế](docs/LIMITATIONS.md)
- [Early arrival và cross-room flow](docs/EARLY_ARRIVAL_AND_CROSS_ROOM_FLOW.md)
