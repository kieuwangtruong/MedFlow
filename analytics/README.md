# VAIC Hospital Data Analytics

> Safety default: report/demo uses `ai/wait_time_module/data/examples/sample_20.csv`. Set `ANALYTICS_USE_LIVE=true` only in an explicitly authorized environment to let the report builder prefer PostgreSQL/Neon. Outputs never retain raw `patient_token`.

Bộ analytics này dùng PostgreSQL/Neon làm nguồn ưu tiên và tự động fallback sang `ai/wait_time_module/data/examples/sample_20.csv`. Không có credential hoặc PII được ghi vào output; `patient_token` được chuyển thành alias SHA-256 rút gọn.

## Deliverables

- `notebooks/01_data_quality_eda.ipynb`: EDA và data-quality notebook chạy top-to-bottom.
- `sql/`: 11 PostgreSQL query đọc-only.
- `dashboard/`: Streamlit dashboard ba trang.
- `outputs/`: extract ẩn danh, quality checks và baseline results.
- `reports/DA_REPORT.md` và `reports/DA_REPORT.html`: báo cáo stakeholder 5–7 trang khi in.

## Chạy bằng PowerShell

```powershell
cd D:\Hackathon_AI\VAIC2026-TuTru
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' -m pip install -r analytics\requirements.txt
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' -m analytics.src.extract
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' -m analytics.src.baseline_simulation --runs 30
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' analytics\scripts\create_notebook.py
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' -m jupyter nbconvert --execute --to notebook --inplace analytics\notebooks\01_data_quality_eda.ipynb
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' analytics\scripts\build_report.py
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' -m pytest analytics\tests -q
& 'C:\Users\TD\AppData\Local\Programs\Python\Python312\python.exe' -m streamlit run analytics\dashboard\app.py
```

Để ép dùng demo CSV, chạy `python -m analytics.src.extract --demo`. SLA trong `config/metrics.yml` là giả định demo cho đến khi bệnh viện phê duyệt ngưỡng thật.
