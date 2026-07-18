# Vietnamese Symptom Department Router

Module phân loại **khoa tiếp nhận** từ mô tả triệu chứng tiếng Việt bằng TF-IDF và Logistic Regression. Hệ thống không chẩn đoán bệnh.

## Luồng xử lý

```text
Bệnh nhân nhập triệu chứng
          ↓
Chuẩn hoá tiếng Việt + phiên bản không dấu
          ↓
Rule Engine kiểm tra dấu hiệu nguy hiểm
          ↓
Có red flag? ── Có → Cấp cứu + nhân viên xác nhận
          │
          Không
          ↓
TF-IDF word/character → Logistic Regression
          ↓
Top 2–3 khoa + xác suất
          ↓
Kiểm tra tuổi, giới tính, khoa đang hoạt động
          ↓
Confidence thấp → Nội tổng quát + human review
```

## Cấu trúc

```text
process_input_data/
├── app/
│   ├── config.py
│   ├── main.py
│   ├── model.py
│   ├── preprocessing.py
│   ├── red_flags.py
│   ├── routing_service.py
│   └── schemas.py
├── data/
├── models/
│   ├── department_router.joblib
│   └── model_metadata.json
├── reports/evaluation.json
├── tests/test_routing.py
├── train.py
├── requirements.txt
└── .env.example
```

## Cài đặt

```bash
cd ai/process_input_data
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Train và đánh giá

```bash
python train.py
```

Script sử dụng split có sẵn trong dataset:

- Train: 700 mẫu.
- Validation: 150 mẫu.
- Test: 150 mẫu.
- Model artifact cuối được fit trên train + validation và đánh giá một lần trên test.

Metric được lưu trong `models/model_metadata.json` và `reports/evaluation.json`, gồm Top-1, Top-2, Top-3 accuracy, macro/weighted F1, log loss và metric red-flag.

## Chạy API

```bash
uvicorn app.main:app --reload --port 8001
```

- Swagger: `http://127.0.0.1:8001/docs`
- Health: `GET http://127.0.0.1:8001/api/v1/health`

### Phân loại khoa

```bash
curl -X POST http://127.0.0.1:8001/api/v1/symptom-routing \
  -H 'Content-Type: application/json' \
  -d '{
    "symptom_text": "Tôi ho nhiều, khò khè và khó thở nhẹ ba ngày nay",
    "age": 35,
    "gender": "MALE",
    "pregnancy_status": "NA",
    "top_k": 3
  }'
```

Response chứa:

- `is_red_flag`: có dấu hiệu nguy hiểm hay không.
- `priority` và `action`.
- `recommendations`: Top 2–3 khoa và confidence.
- `confidence_low` và `requires_human_review`.
- Thông báo rõ đây không phải chẩn đoán.

## Quy tắc an toàn

- Red-flag được kiểm tra trước model.
- Có red-flag: chỉ trả khoa Cấp cứu, priority `EMERGENCY` và bắt buộc human review.
- Confidence dưới ngưỡng: ưu tiên Nội tổng quát và yêu cầu nhân viên xác nhận.
- Bệnh nhân dưới 16 tuổi được ưu tiên Nhi khoa.
- Kết quả được lọc theo tuổi, giới và danh sách khoa đang hoạt động.
- Không tự động đưa ra chẩn đoán hoặc quyết định điều trị.

## Giới hạn

Dataset hiện tại là dữ liệu tổng hợp và chưa được bệnh viện/bác sĩ thẩm định. Metric cao trên test synthetic không đại diện cho hiệu quả lâm sàng thực tế. Trước khi triển khai cần dữ liệu thật đã ẩn danh, kiểm định ngoài mẫu, đánh giá bias và phê duyệt của chuyên gia y tế.
