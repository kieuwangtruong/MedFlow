# Smart Hospital Unified AI API

Một FastAPI service duy nhất load và phục vụ hai model:

1. Dự báo số lượng check-in và khung giờ cao điểm.
2. Phân loại khoa tiếp nhận từ mô tả triệu chứng tiếng Việt.

Hai thư mục con vẫn giữ riêng dữ liệu, artifact và script train để dễ bảo trì. Runtime được gộp tại `ai/main.py`, vì vậy không cần chạy hai Uvicorn process.

## Cài đặt

Đứng tại thư mục `ai`:

```bash
cd /Users/vominhquan/Documents/VAIC2026-TuTru/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Đảm bảo hai model đã được train:

```text
peak_hour_prediction/models/checkin_forecast_model.joblib
process_input_data/models/department_router.joblib
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

### Phân loại khoa

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
cd peak_hour_prediction
python train.py

cd ../process_input_data
python train.py
```

Sau khi train lại, restart unified service để nạp artifact mới.
