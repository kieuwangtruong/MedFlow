# Hướng dẫn tích hợp và chạy demo local

## 1. Cài dependency

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru\backend
npm ci
npm run prisma:generate

cd ..\frontend
npm ci

cd ..\ai\wait_time_module
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
```

## 2. Khởi tạo database và chạy unified AI service

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru\ai\wait_time_module
Copy-Item .env.example .env
.\.venv\Scripts\python.exe scripts\init_db.py
.\.venv\Scripts\python.exe scripts\migrate_local_db.py

cd ..
.\wait_time_module\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

Lệnh trên chạy unified FastAPI để backend dùng chung routing/AI và Wait-Time routes. Nếu chỉ demo Wait-Time độc lập, chạy `app.main:app` từ thư mục `ai\wait_time_module`.

Terminal khác:

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru\ai\wait_time_module
.\.venv\Scripts\python.exe scripts\smoke_test_api.py
.\.venv\Scripts\python.exe scripts\demo_early_arrival_cross_room.py
.\.venv\Scripts\python.exe examples\routing_client.py
```

## 3. Chạy backend và frontend

Backend cần `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`, `AI_SERVICE_URL=http://127.0.0.1:8000`; xem `backend/.env.example`.

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru\backend
npm run dev
```

Frontend đặt `VITE_API_BASE_URL=http://localhost:3000/api/v1`. Production luôn tắt mock bằng code; local muốn API thật đặt `VITE_USE_MOCK_API=false`.

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru\frontend
npm run dev
```

## 4. Verify trước demo

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru\backend
npm test
npm run lint

cd ..\frontend
npm test
npm run lint
npm run build

cd ..\ai\wait_time_module
.\.venv\Scripts\python.exe -m pytest -q
```

Không chạy nhiều Uvicorn workers với SQLite. Không deploy hoặc dùng credential thật theo hướng dẫn local này.
