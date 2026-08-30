# Báo Cáo Phân Tích Khám Phá Dữ Liệu Y Tế (Healthcare Exploratory Data Analysis)

> **Tự động sinh bởi:** MedFlow Advanced Statistical Engine  
> **Nguồn dữ liệu:** seeded synthetic CSV: sample_20.csv  
> **Tổng số bản ghi:** 20 tasks, 5 journeys  

---

## 1. Thống Kê Phân Phối Thời Gian Chờ & Thời Gian Khám (Statistical Distribution Moments)

| Chỉ số Thống kê | Thời gian Chờ Vận hành (Phút) | Thời gian Khám/Thủ thuật (Phút) |
| :--- | :--- | :--- |
| **Kích thước mẫu (Count)** | 20 | 20 |
| **Trung bình (Mean $\mu$)** | 13.27 | 9.63 |
| **Độ lệch chuẩn (Std $\sigma$)** | 8.08 | 3.91 |
| **Trung vị (Median / P50)** | 12.38 | 10.37 |
| **Phân vị 25% (P25 / Q1)** | 7.91 | 6.72 |
| **Phân vị 75% (P75 / Q3)** | 14.99 | 12.08 |
| **Khoảng phân vị (IQR)** | 7.08 | 5.36 |
| **Phân vị 80% (P80)** | 17.3 | 12.47 |
| **Phân vị 90% (P90)** | 23.23 | 14.13 |
| **Hệ số Bất đối xứng (Skewness)** | 1.59 | -0.2 |
| **Độ nhọn phân phối (Kurtosis)** | 2.96 | -0.75 |
| **Hệ số Biến thiên (CV)** | 0.609 | 0.406 |

---

## 2. Hiệu Suất Theo Chuyên Khoa Lâm Sàng (Specialty Performance Breakdown)

| specialty_or_service | total_tasks | completed_tasks | median_wait_p50 | wait_p80 | wait_p90 | mean_wait | median_service_duration | sla_breach_rate | sla_compliance_rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Khám Nội tổng quát | 10 | 0 | 12.91 | 18.10 | 23.23 | 13.31 | 7.13 | 0.00 | 1.00 |
| Chẩn đoán hình ảnh - Siêu âm | 6 | 0 | 10.94 | 18.90 | 28.05 | 15.18 | 10.67 | 0.33 | 0.67 |
| Chẩn đoán hình ảnh - X-quang | 4 | 0 | 11.49 | 13.14 | 13.28 | 10.32 | 12.62 | 0.00 | 1.00 |

---

## 3. Tuân Thủ Chuẩn SLA Theo Mức Độ Ưu Tiên Y Khoa

| clinical_priority | total_tasks | sla_target_minutes | median_wait | p80_wait | p90_wait | breach_count | sla_breach_rate | sla_compliance_rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| URGENT | 3 | 15.00 | 12.98 | 16.53 | 17.72 | 1 | 0.33 | 0.67 |
| NORMAL | 17 | 30.00 | 11.93 | 16.39 | 24.19 | 1 | 0.06 | 0.94 |

---

## 4. Phân Tích Nút Thắt Cổ Chai Hành Trình 3 Bước ($A \to B \to A'$)

* **Giai đoạn 1 (Khám ban đầu - INITIAL_CONSULT):** Median Wait = `12.831341865` phút, P80 = `14.967458575780002` phút.
* **Giai đoạn 2 (Cận lâm sàng - DIAGNOSTIC_SERVICE):** Median Wait = `10.9783924886` phút, P80 = `14.517977320020002` phút.
* **Giai đoạn 3 (Tái khám kết luận - RETURN_REVIEW):** Median Wait = `14.3564532569` phút, P80 = `18.7405143309` phút.
* **Thời gian Chờ Trả Kết quả Chẩn đoán hình ảnh (Turnaround Time):** Median = `6.969669013700001` phút, P80 = `16.88060010222` phút, P90 = `18.941904465740002` phút.

---
*Báo cáo xuất bản tự động vào thư mục `analytics/reports/`.*
