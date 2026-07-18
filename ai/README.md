# Smart Hospital Unified AI API

Một FastAPI service duy nhất phục vụ ba chức năng AI/vận hành:

1. Dự báo số lượng check-in và khung giờ cao điểm.
2. Phân loại phòng khám tiếp nhận từ mô tả triệu chứng tiếng Việt.
3. Ước tính thời gian chờ và vận hành hàng đợi/phòng khám.

Hai thư mục con vẫn giữ riêng dữ liệu, artifact và script train để dễ bảo trì. Runtime được gộp tại `ai/main.py`, vì vậy không cần chạy hai Uvicorn process.

## Cài đặt

Project khóa Python `3.12.11` trong `.python-version` để các dependency khoa học
và `pydantic-core` dùng wheel dựng sẵn khi deploy trên Render.

Đứng tại thư mục `ai`:

```bash
cd /Users/vominhquan/Documents/VAIC2026-TuTru/ai
source process_input_data/.venv/bin/activate
pip install -r requirements.txt
```

Đảm bảo hai model đã được train:

```text
peak_hour_prediction/models/checkin_forecast_model.joblib
process_input_data/models/clinic_room_router.joblib
```

## Chạy một service duy nhất

```bash
uvicorn main:app --reload --port 8000
```

Lệnh tương thích sau cũng chạy cùng unified app:

```bash
uvicorn app.main:app --reload --port 8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Endpoint

```text
GET  /api/v1/health
POST /api/v1/forecasts
POST /api/v1/symptom-routing
GET  /health
GET  /api/v1/rooms/status
GET  /api/v1/patients/{patient_token}/estimate
POST /api/v1/events
POST /api/v1/estimates/room-options
```

Alias tương thích với contract Frontend cũng được hỗ trợ:

```text
POST /api/v1/ai/symptom-routing
```

### Dự báo cao điểm

```json
POST /api/v1/forecasts
{
  "days": 1
}
```

### Phân loại phòng khám

```json
POST /api/v1/symptom-routing
{
  "symptom_text": "Tôi ho nhiều và khò khè ba ngày nay",
  "age": 35,
  "gender": "MALE",
  "pregnancy_status": "NA",
  "top_k": 3
}
```

## Train lại từng model

Train vẫn thực hiện riêng vì dataset và bài toán khác nhau:

```bash
python -m peak_hour_prediction.train
python -m process_input_data.train
```

Sau khi train lại, restart unified service để nạp artifact mới.
