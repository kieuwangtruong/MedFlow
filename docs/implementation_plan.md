# Kế Hoạch Nâng Cấp Phân Hệ Dữ Liệu & Phân Tích MedFlow Đạt Chuẩn Enterprise Data Analyst / Data Engineer

Bản kế hoạch kỹ thuật chi tiết để chuyển đổi phân hệ dữ liệu của MedFlow thành một sản phẩm mẫu mực (Showcase Portfolio) cho vị trí **Enterprise Data Analyst / Data Engineer**, kết hợp hoàn chỉnh giữa **Data Engineering (Medallion & Star Schema, Data Quality, ETL/ELT Pipeline)**, **Advanced Analytics (EDA, Phân vị P50/P80/P90, Dự báo ML, Mô phỏng San tải)** và **Executive BI Dashboarding (Streamlit & Power BI DAX)**.

---

## User Review Required

> [!IMPORTANT]
> **Phạm vi triển khai không làm ảnh hưởng (Zero-Downtime / Non-Breaking) đến hệ thống OLTP hiện tại:**
> 1. Toàn bộ logic backend (Node.js/Prisma) và AI Service (FastAPI) giữ nguyên API Contract hiện có.
> 2. Các pipeline mới sẽ tập trung trong thư mục `analytics/`, mở rộng thư mục `docs/` và nâng cấp tài liệu `README.md`.
> 3. Dữ liệu sẽ hỗ trợ song song 2 chế độ: Trích xuất trực tiếp từ Neon PostgreSQL (khi có kết nối) và chế độ nạp hạt giống dữ liệu giả lập chuẩn hóa (Synthetic Offline Mode) để đảm bảo có thể chạy và tái lập 100% trong môi trường local/CI.

---

## Open Questions

> [!NOTE]
> Các câu hỏi thiết kế đã được mặc định theo Best Practices của ngành, nếu có yêu cầu đặc biệt vui lòng phản hồi:
> - **Power BI:** Dự án sẽ cung cấp trọn bộ script định nghĩa mô hình ngữ nghĩa (Semantic Model Schema) và các công thức **DAX Measures** chuẩn doanh nghiệp đi kèm tài liệu hướng dẫn import dữ liệu, song song với ứng dụng trực quan hóa chính trên **Streamlit** (4 màn hình).
> - **Định dạng lưu trữ Data Mart:** Sử dụng định dạng chuẩn công nghiệp **Parquet** (hiệu năng cao, tiết kiệm dung lượng và bảo toàn kiểu dữ liệu) cùng xuất bản định dạng **CSV/DuckDB** để dễ dàng kết nối với Power BI/Tableau/Excel.

---

## Proposed Changes

### 1. Phân hệ Tài liệu Kỹ thuật & Từ điển Dữ liệu (Documentation & Governance)

#### [MODIFY] [DATA_DICTIONARY.md](file:///c:/Users/Administrator/Med/MedFlow/docs/DATA_DICTIONARY.md)
- Nâng cấp toàn diện tài liệu Data Dictionary theo chuẩn DAMA-DMBOK:
  - Bổ sung bảng mô tả chi tiết cho toàn bộ 11 bảng OLTP Prisma (`patients`, `patient_journeys`, `patient_journey_tasks`, `patient_queue_entries`, `clinic_rooms`, `clinical_specialties`, `departments`, `doctor_room_assignments`, `hospital_edges`, `equipments`, `checkin_slot_statistics`).
  - Bổ sung cấu trúc dữ liệu Data Mart tầng Gold (`fact_patient_journey`, `fact_task_execution`, và các bảng dimension).
  - Định nghĩa tường minh các kiểu dữ liệu, ràng buộc (PK/FK/Nullability), giá trị mặc định, quy tắc chất lượng dữ liệu (Data Quality Rule) và ý nghĩa nghiệp vụ y tế.

#### [NEW] [ARCHITECTURE_DATA.md](file:///c:/Users/Administrator/Med/MedFlow/docs/ARCHITECTURE_DATA.md)
- Tài liệu kiến trúc dữ liệu chuyên biệt:
  - Sơ đồ luồng dữ liệu (Data Flow Diagram / C4 Container Diagram).
  - Kiến trúc Medallion (Bronze: Ingestion Raw $\to$ Silver: Cleansed & Anonymized $\to$ Gold: Star Schema Data Mart).
  - Mô hình bảo mật và ẩn danh hóa dữ liệu y tế (PII Masking & SHA-256 Hashing).

---

### 2. Phân hệ Pipeline Dữ liệu & Kiểm soát Chất lượng (Data Engineering & Pipeline Layer)

#### [MODIFY] [extract.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/src/extract.py)
- Nâng cấp quy trình trích xuất dữ liệu:
  - Hỗ trợ trích xuất đa thực thể (Join đầy đủ thông tin bệnh nhân, hành trình, nhiệm vụ khám, phòng khám, chuyên khoa, hàng đợi, bác sĩ).
  - Hỗ trợ lưu trữ tầng Bronze (dữ liệu thô) và Silver (dữ liệu đã chuẩn hóa múi giờ `Asia/Ho_Chi_Minh` và băm ẩn danh `patient_token`).

#### [MODIFY] [data_quality.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/src/data_quality.py)
- Mở rộng bộ 15+ Data Quality Rules:
  - Kiểm tra tính toàn vẹn khóa chính/khóa ngoại, không trùng lặp và không rỗng.
  - Kiểm tra logic chuỗi thời gian: $\text{checkin\_at} \le \text{arrival\_time} \le \text{ready\_at} \le \text{service\_start} \le \text{service\_end}$.
  - Phát hiện và gắn cờ ngoại lai (Outlier): Thời gian khám $> 180$ phút, hành trình $> 24$ giờ, thời gian chờ âm.
  - Kiểm tra đồ thị DAG không chu trình (Acyclic check trên `patient_task_dependencies`).
  - Xuất báo cáo chất lượng tự động `data_quality_report.json` và `data_quality_checks.csv`.

#### [NEW] [datamart.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/src/datamart.py)
- Xây dựng module tự động chuyển đổi dữ liệu Silver sang Lược đồ Star Schema tầng Gold:
  - Tạo bảng `fact_patient_journey` (Grain: 1 dòng = 1 hành trình khám).
  - Tạo bảng `fact_task_execution` (Grain: 1 dòng = 1 nhiệm vụ khám/xét nghiệm).
  - Tạo các bảng chiều: `dim_patient`, `dim_doctor`, `dim_clinic_room`, `dim_specialty`, `dim_date`, `dim_time_slot`.
  - Xuất bản dữ liệu sang thư mục `analytics/outputs/datamart/` dưới dạng file Parquet & CSV.

---

### 3. Phân hệ Phân tích Nâng cao & Trí tuệ Nhân tạo (Advanced Analytics & Modeling)

#### [MODIFY] [metrics.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/src/metrics.py)
- Bổ sung các công thức phân tích chuyên sâu:
  - Tính toán phân vị chính xác $P_{50}, P_{80}, P_{90}$ cho 12 chuyên khoa lâm sàng.
  - Đo lường phương sai, độ lệch phân phối (Skewness/Kurtosis) và khoảng phân vị (IQR).
  - Tính toán tỷ lệ vi phạm SLA (`sla_breach_rate`) theo từng mức độ ưu tiên (`EMERGENCY: 5m`, `URGENT: 15m`, `NORMAL: 30m`, `NON_URGENT: 60m`).
  - Phân tích chi tiết thời gian nút thắt cổ chai ở luồng 3 bước ($A \to B \to A'$).

#### [NEW] [simulation_engine.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/src/simulation_engine.py)
- Thuật toán mô phỏng san tải phòng khám (Queue Load Balancing Simulation):
  - Mô phỏng so sánh 3 chiến lược: Static/Round-robin, Shortest Queue First (SQF) và AI-driven P80 Estimated Wait.
  - Đo lường chỉ số giảm thời gian chờ thực tế ($\Delta W$) và cân bằng công suất giữa các phòng khám.

#### [NEW] [01_eda_and_statistical_analysis.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/scripts/01_eda_and_statistical_analysis.py)
- Script thực thi toàn bộ bài toán phân tích khám phá (EDA) tự động, xuất các bảng thống kê và biểu đồ phân phối chất lượng cao vào `analytics/reports/`.

---

### 4. Phân hệ Trực quan hóa & Báo cáo Vận hành (BI & Visualization Layer)

#### [MODIFY] [app.py](file:///c:/Users/Administrator/Med/MedFlow/analytics/dashboard/app.py) & Trang Dashboard
- Tái cấu trúc và nâng cấp giao diện Streamlit thành **Executive Control Center** gồm 4 trang chuyên biệt:
  - **Trang 1: Executive Overview (`1_Executive_Overview.py`):** KPI thẻ điểm toàn viện, xu hướng lượt khám, phân vị thời gian chờ theo 12 chuyên khoa, tỷ lệ vi phạm SLA.
  - **Trang 2: Room Operations & Bottlenecks (`2_Room_Operations.py`):** Heatmap tải phòng theo giờ, tương quan hàng đợi vs thời gian chờ, phân tích tác động khi hỏng máy/ca cấp cứu.
  - **Trang 3: Patient Journey & Bottlenecks (`3_Patient_Journey.py`):** Phân tích luồng khám $A \to B \to A'$, thời gian chờ kết quả cận lâm sàng, bảng drill-down từng ca bệnh.
  - **Trang 4: AI Forecast & Simulation Sandbox (`4_Simulation_Sandbox.py`):** [MỚI] Dự báo lượng bệnh nhân theo khung giờ 30 phút và bảng điều khiển mô phỏng san tải tương tác (Interactive What-if Analysis).

#### [NEW] [DAX_Measures.dax](file:///c:/Users/Administrator/Med/MedFlow/analytics/powerbi/DAX_Measures.dax) & [powerbi_schema.json](file:///c:/Users/Administrator/Med/MedFlow/analytics/powerbi/powerbi_schema.json)
- Bộ tài liệu thiết kế Power BI dành cho doanh nghiệp:
  - Script tổng hợp hơn 15+ công thức DAX chuẩn (Time Intelligence, Dynamic Percentiles $P_{80}/P_{90}$, SLA Breach %, Utilization Rate).
  - Sơ đồ hướng dẫn thiết lập mối quan hệ Star Schema trong Power BI Desktop.

---

### 5. Đóng gói Tài liệu Portfolio & Portfolio Pitch

#### [MODIFY] [README.md](file:///c:/Users/Administrator/Med/MedFlow/README.md)
- Nâng cấp README chính của dự án:
  - Bổ sung sơ đồ kiến trúc dữ liệu tổng thể (Mermaid Data Flow Diagram).
  - Bổ sung mục Data Engineering Highlights & Data Quality Assurance.
  - Bổ sung mục Quantitative Impact & Business Results (Số liệu định lượng chứng minh hiệu quả giảm thời gian chờ).
  - Cung cấp sẵn các mẫu câu mô tả kinh nghiệm (Resume / Portfolio Bullets) sẵn sàng đưa vào CV ứng tuyển Data Analyst / Data Engineer.

---

## Verification Plan

### 1. Automated Tests (Kiểm thử Tự động)
- Chạy kiểm thử toàn bộ module chất lượng dữ liệu và tính toán chỉ số:
  ```powershell
  cd analytics
  pytest tests/ -v
  ```
- Kiểm tra quá trình trích xuất và tạo Data Mart:
  ```powershell
  python -m analytics.src.extract --demo
  python -m analytics.src.datamart
  ```
  *Kỳ vọng:* Xuất thành công các file `fact_patient_journey.parquet`, `fact_task_execution.parquet` và `data_quality_report.json` không gặp lỗi critical.

### 2. Manual & Dashboard Verification (Kiểm thử Giao diện & Trực quan hóa)
- Khởi chạy Dashboard Streamlit và kiểm tra tương tác:
  ```powershell
  streamlit run analytics/dashboard/app.py
  ```
  *Kỳ vọng:* Cả 4 trang (`Executive Overview`, `Room Operations`, `Patient Journey`, `Simulation Sandbox`) hiển thị đầy đủ biểu đồ, bộ lọc hoạt động mượt mà, không có lỗi render.
- Kiểm tra tính đầy đủ của tài liệu `DATA_DICTIONARY.md`, `ARCHITECTURE_DATA.md` và `README.md`.
