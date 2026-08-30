# Data Dictionary (Từ Điển Dữ Liệu) - MedFlow Enterprise Healthcare Platform

> **Tiêu chuẩn áp dụng:** DAMA-DMBOK (Data Management Body of Knowledge) & HL7 FHIR FHIR-Aligned Data Model  
> **Phiên bản:** 2.0.0 (Enterprise Data Analytics & Engineering Release)  
> **Phân loại dữ liệu:** Dữ liệu Y tế Vận hành & Phân tích (Healthcare Operations & Analytics)  
> **Chính sách Bảo mật:** Tuân thủ HIPAA / Nghị định 13/2023/NĐ-CP (Bảo vệ dữ liệu cá nhân - PII Hashing SHA-256)

---

## 1. Tổng Quan Kiến Trúc Dữ Liệu (Data Architecture Overview)

Hệ thống dữ liệu MedFlow được tổ chức theo mô hình **Medallion Architecture** kết hợp **Star Schema** cho tầng phục vụ phân tích (Serving Layer):

```
+-----------------------------------------------------------------------+
| 1. OLTP Operational Data Store (Neon PostgreSQL / Prisma ORM)         |
|    11 Core Tables: Patients, Journeys, Tasks, Queues, Rooms, etc.     |
+-----------------------------------+-----------------------------------+
                                    | [ELT / Anonymization Pipeline]
                                    v
+-----------------------------------------------------------------------+
| 2. Silver Data Layer (Cleansed, Standardized UTC+7, PII SHA-256)     |
|    task_silver, journey_silver, queue_silver                          |
+-----------------------------------+-----------------------------------+
                                    | [Dimensional Modeling]
                                    v
+-----------------------------------------------------------------------+
| 3. Gold Data Mart Layer (Star Schema - Parquet / CSV / DuckDB)        |
|    Facts: fact_patient_journey, fact_task_execution                   |
|    Dims:  dim_patient, dim_doctor, dim_clinic_room, dim_specialty,    |
|           dim_date, dim_time_slot                                     |
+-----------------------------------------------------------------------+
```

---

## 2. Chi Tiết Lược Đồ Tầng OLTP (Operational Storage Layer - 11 Bảng)

### 2.1. Bảng `patients` (Thông tin Bệnh nhân)
* **Grain:** 1 dòng đại diện cho 1 hồ sơ bệnh nhân duy nhất trong hệ thống.
* **Mục đích:** Quản lý định danh hành chính bệnh nhân.

| Tên trường (Column) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Quy tắc chất lượng (DQ Rule) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `String` (CUID) | PK, Not Null | `cuid()` | Unique, Non-empty | Mã định danh nội bộ hệ thống |
| `identification_code` | `String` | Unique, Not Null | - | Regex `^[A-Z0-9]{8,12}$` | Mã căn cước công dân / Mã định danh y tế |
| `patient_token` | `String` | Unique, Not Null | - | Unique, Secure Token | Mã token phiên khám / QR check-in của bệnh nhân |
| `full_name` | `String` | Nullable | `NULL` | Trimmed string | Họ và tên đầy đủ (PII - Cần ẩn danh khi sang Analytics) |
| `phone_number` | `String` | Nullable | `NULL` | Regex `^[0-9]{10,11}$` | Số điện thoại liên hệ (PII) |
| `date_of_birth` | `Date` | Nullable | `NULL` | $1900-01-01 \le \text{DOB} \le \text{Today}$ | Ngày tháng năm sinh |
| `status` | `Enum` | Not Null | `ACTIVE` | In `[ACTIVE, INACTIVE, MERGED]` | Trạng thái hoạt động của hồ sơ bệnh nhân |
| `created_at` | `Timestamptz` | Not Null | `now()` | UTC Timestamp | Thời điểm tạo hồ sơ |
| `updated_at` | `Timestamptz` | Not Null | Auto | $\ge \text{created\_at}$ | Thời điểm cập nhật cuối cùng |

---

### 2.2. Bảng `patient_journeys` (Hành trình Khám Toàn Diện)
* **Grain:** 1 dòng đại diện cho 1 đợt khám bệnh (Episode of Care / Journey) của bệnh nhân từ khi check-in đến khi hoàn tất.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Quy tắc chất lượng (DQ Rule) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `journey_id` (`id`) | `String` (CUID) | PK, Not Null | `cuid()` | Unique | Mã định danh duy nhất của lượt khám |
| `patient_token` | `String` | FK $\to$ `patients.patient_token` | Not Null | Phải tồn tại trong `patients` | Khóa liên kết bệnh nhân |
| `checkin_at` | `Timestamptz` | Nullable | `NULL` | $\le \text{now()}$ | Thời điểm bệnh nhân quét mã / làm thủ tục check-in |
| `severity_score` | `Int` | Nullable | `NULL` | $1 \le \text{Score} \le 5$ (ESI Triage) | Điểm phân loại mức độ nguy kịch ban đầu |
| `symptom_description`| `String` | Nullable | `NULL` | Max 1000 ký tự | Mô tả triệu chứng lâm sàng khi tiếp đón |
| `symptom_payload` | `Json` | Nullable | `NULL` | Valid JSON Schema | Cấu trúc dữ liệu triệu chứng phân tích bởi AI Triage |
| `symptoms_submitted_at`| `Timestamptz`| Nullable | `NULL` | $\ge \text{checkin\_at}$ | Thời điểm gửi triệu chứng phân loại |
| `intake_source` | `Enum` | Nullable | `NULL` | In `[PATIENT_SELF, STAFF_DESK, KIOSK]` | Kênh tiếp nhận bệnh nhân (Kiosk, Lễ tân, Tự khai báo) |
| `created_at` | `Timestamptz` | Not Null | `now()` | UTC Timestamp | Thời điểm khởi tạo hành trình |
| `updated_at` | `Timestamptz` | Not Null | Auto | $\ge \text{created\_at}$ | Thời điểm cập nhật cuối |

---

### 2.3. Bảng `patient_journey_tasks` (Nhiệm vụ / Dịch vụ trong Hành trình)
* **Grain:** 1 dòng đại diện cho 1 bước khám lâm sàng, cận lâm sàng hoặc tái khám của bệnh nhân.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Quy tắc chất lượng (DQ Rule) | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `task_id` (`id`) | `String` | PK, Not Null | Unique, Non-null | Mã định danh bước khám |
| `journey_id` | `String` | FK $\to$ `patient_journeys` | Not Null | Khóa ngoại tới hành trình |
| `journey_step` | `Enum` | Not Null | In `[INITIAL_CONSULT, DIAGNOSTIC_SERVICE, RESULT_PENDING, RETURN_REVIEW]` | Giai đoạn trong quy trình khám |
| `parent_task_id` | `String` | FK Self-reference | Nullable | Task gốc sinh ra chuỗi cận lâm sàng |
| `depends_on_task_id` | `String` | FK Self-reference | DAG acyclic (Không có chu trình phụ thuộc) | Task tiền đề phải hoàn thành trước |
| `patient_token` | `String` | FK $\to$ `patients` | Not Null | Token bệnh nhân |
| `department_id` | `String` | FK $\to$ `departments` | Nullable | Mã khoa chuyên môn phụ trách |
| `specialty_id` | `String` | FK $\to$ `clinical_specialties` | Nullable | Mã chuyên khoa cụ thể |
| `queue_id` | `String` | FK $\to$ `service_queues` | Nullable | Mã hàng đợi tiếp nhận |
| `room_id` | `String` | FK $\to$ `clinic_rooms` | Nullable | Mã phòng khám/thực hiện dịch vụ |
| `task_type` | `Enum` | Not Null | In `[INITIAL_CONSULT, DIAGNOSTIC_SERVICE, RETURN_REVIEW]` | Phân loại nghiệp vụ của nhiệm vụ |
| `status` | `Enum` | Not Null | In `[PENDING, READY, IN_QUEUE, IN_SERVICE, WAITING_RESULT, COMPLETED, CANCELLED, SKIPPED]` | Trạng thái vòng đời của nhiệm vụ |
| `service_type` | `Enum` | Not Null | In `[CLINICAL_CONSULT, XRAY, ABDOMINAL_ULTRASOUND, RESULT_REVIEW]` | Loại dịch vụ y tế |
| `clinical_priority` | `Enum` | Not Null | In `[EMERGENCY, URGENT, NORMAL, NON_URGENT]` | Mức độ ưu tiên y khoa (SLA Target) |
| `doctor_id` | `String` | FK $\to$ `staff_users` | Nullable | Bác sĩ trực tiếp khám/đọc kết quả |
| `device_id` | `String` | FK $\to$ `equipments` | Nullable | Thiết bị thực hiện cận lâm sàng |
| `arrival_time` | `Timestamptz` | Nullable | $\ge \text{checkin\_at}$ | Thời điểm bệnh nhân có mặt tại cửa phòng khám |
| `ready_at` | `Timestamptz` | Nullable | $\ge \text{arrival\_time}$ | Thời điểm đủ điều kiện gọi vào khám |
| `service_start` | `Timestamptz` | Nullable | $\ge \text{ready\_at}$ | Thời điểm bác sĩ bấm bắt đầu khám |
| `service_end` | `Timestamptz` | Nullable | $\ge \text{service\_start}$ | Thời điểm kết thúc phiên khám |
| `completed_at` | `Timestamptz` | Nullable | $\ge \text{service\_end}$ | Thời điểm phê duyệt hoàn tất kết quả |
| `result_ready_at` | `Timestamptz` | Nullable | $\ge \text{service\_end}$ | Thời điểm có kết quả xét nghiệm/CĐHA |
| `actual_wait_time` | `Float` | Nullable | $\ge 0$ (phút) | Thời gian chờ thực tế ($\text{service\_start} - \text{ready\_at}$) |
| `active_service_duration`| `Float`| Nullable | $\ge 0$ (phút) | Thời gian phục vụ thuần túy không gián đoạn |
| `interruption_duration`| `Float`| Nullable | $\ge 0$ (phút) | Thời gian gián đoạn do ca cấp cứu/sự cố thiết bị |
| `resource_failure` | `Boolean` | Not Null (Default `false`)| `true`/`false` | Đánh dấu sự cố thiết bị/phòng |
| `no_show` | `Boolean` | Not Null (Default `false`)| `true`/`false` | Đánh dấu bệnh nhân vắng mặt khi được gọi |
| `emergency_insertion` | `Boolean` | Not Null (Default `false`)| `true`/`false` | Đánh dấu ca cấp cứu chen ngang hàng đợi |

---

### 2.4. Bảng `patient_queue_entries` (Bản ghi Hàng đợi Khám)
* **Grain:** 1 dòng đại diện cho 1 lượt đăng ký vị trí hàng đợi của một nhiệm vụ.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` (CUID) | PK, Not Null | Mã bản ghi hàng đợi |
| `queue_id` | `String` | FK $\to$ `service_queues.id` | Mã hàng đợi dịch vụ |
| `task_id` | `String` | FK $\to$ `patient_journey_tasks.id` | Mã nhiệm vụ liên kết |
| `status` | `Enum` | In `[WAITING, CALLED, IN_SERVICE, DONE, CANCELLED, NO_SHOW]` | Trạng thái hàng đợi hiện tại |
| `priority` | `Enum` | In `[EMERGENCY, URGENT, NORMAL, NON_URGENT]` | Ưu tiên gọi số |
| `queue_number` | `Int` | Nullable | Số thứ tự cấp cho bệnh nhân (STT) |
| `position` | `Int` | Nullable | Vị trí thứ tự hàng đợi thực tế |
| `enqueued_at` | `Timestamptz` | Not Null (Default `now()`) | Thời điểm vào hàng đợi |
| `called_at` | `Timestamptz` | Nullable | Thời điểm loa/màn hình gọi tên |
| `service_start_at`| `Timestamptz` | Nullable | Thời điểm vào phòng bắt đầu khám |
| `service_end_at` | `Timestamptz` | Nullable | Thời điểm ra khỏi phòng khám |

---

### 2.5. Bảng `departments` (Khoa Chuyên Môn)
* **Grain:** 1 dòng đại diện cho 1 khoa của bệnh viện.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` | PK, Not Null | Mã khoa (VD: `GENERAL`, `CARD`, `IMAGING`) |
| `name` | `String` | Not Null | Tên khoa (VD: Khoa Tim mạch, Khoa CĐHA) |
| `code` | `String` | Unique, Nullable | Mã code viết tắt |
| `is_active` | `Boolean` | Not Null (Default `true`) | Trạng thái hoạt động |

---

### 2.6. Bảng `clinical_specialties` (Chuyên Khoa Lâm Sàng)
* **Grain:** 1 dòng đại diện cho 1 chuyên khoa thuộc một khoa chuyên môn.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` | PK, Not Null | Mã chuyên khoa (VD: `SPEC-CARD-CONSULT`) |
| `department_id` | `String` | FK $\to$ `departments.id` | Khoa chủ quản |
| `name` | `String` | Not Null | Tên chuyên khoa |
| `code` | `String` | Unique, Nullable | Mã chuyên khoa |
| `is_active` | `Boolean` | Not Null (Default `true`) | Trạng thái hoạt động |

---

### 2.7. Bảng `clinic_rooms` (Phòng Khám & Phòng Thủ Thuật)
* **Grain:** 1 dòng đại diện cho 1 phòng vật lý trong bệnh viện.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` | PK, Not Null | Mã phòng (VD: `ROOM-CARD-201`) |
| `specialty_id` | `String` | FK $\to$ `clinical_specialties.id` | Chuyên khoa đảm trách |
| `doctor_id` | `String` | FK $\to$ `staff_users.id` (Nullable) | Bác sĩ phụ trách chính hiện tại |
| `name` | `String` | Not Null | Tên hiển thị của phòng |
| `code` | `String` | Unique, Nullable | Mã hiệu phòng (VD: `TM-201`) |
| `floor` | `String` | Nullable | Tầng / Vị trí tòa nhà |
| `is_active` | `Boolean` | Not Null (Default `true`) | Sẵn sàng tiếp nhận |

---

### 2.8. Bảng `doctor_room_assignments` (Phân Công Lịch Trực Bác Sĩ)
* **Grain:** 1 dòng đại diện cho 1 ca trực của bác sĩ tại một phòng khám.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` (CUID) | PK, Not Null | Mã ca phân công |
| `doctor_id` | `String` | FK $\to$ `staff_users.id` | Mã bác sĩ |
| `room_id` | `String` | FK $\to$ `clinic_rooms.id` | Mã phòng khám |
| `role` | `Enum` | In `[PRIMARY, SUPPORT, COVERING]` | Vai trò trong ca trực |
| `status` | `Enum` | In `[SCHEDULED, ACTIVE, ENDED, CANCELLED]` | Trạng thái ca trực |
| `shift_start` | `Timestamptz` | Not Null | Thời điểm bắt đầu ca |
| `shift_end` | `Timestamptz` | Not Null ($\ge \text{shift\_start}$) | Thời điểm kết thúc ca |

---

### 2.9. Bảng `equipments` (Trang Thiết Bị Y Tế & Máy Cận Lâm Sàng)
* **Grain:** 1 dòng đại diện cho 1 máy/thiết bị y tế (Máy X-quang, Máy Siêu âm, v.v.).

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` (CUID) | PK, Not Null | Mã thiết bị |
| `name` | `String` | Not Null | Tên máy (VD: Máy Siêu âm tim 4D) |
| `code` | `String` | Unique, Nullable | Mã quản lý tài sản |
| `room_id` | `String` | FK $\to$ `clinic_rooms.id` | Phòng đặt thiết bị |
| `status` | `Enum` | In `[ACTIVE, INACTIVE]` | Trạng thái sẵn sàng hoạt động |

---

### 2.10. Bảng `hospital_edges` (Ma Trận Khoảng Cách & Thời Gian Di Chuyển)
* **Grain:** 1 dòng đại diện cho 1 cung đồ thị kết nối giữa 2 phòng khám.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `String` (CUID) | PK, Not Null | Mã cạnh đồ thị |
| `from_room_id` | `String` | FK $\to$ `clinic_rooms.id` | Phòng xuất phát |
| `to_room_id` | `String` | FK $\to$ `clinic_rooms.id` | Phòng đích đến |
| `travel_minutes` | `Float` | Not Null ($\ge 0$) | Thời gian bệnh nhân đi bộ trung bình (phút) |

---

### 2.11. Bảng `checkin_slot_statistics` (Thống Kê Lưu Lượng Khám Theo Slot 30 Phút)
* **Grain:** 1 dòng đại diện cho 1 khung giờ 30 phút trong một ngày cụ thể.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `Int` | PK, Autoincrement | Mã bản ghi |
| `checkin_time` | `Timestamp` | Unique, Not Null | Mốc thời gian bắt đầu slot |
| `date` | `Date` | Not Null | Ngày khám |
| `slot_start` | `VarChar(5)` | Not Null (VD: `08:00`) | Giờ bắt đầu slot |
| `slot_index` | `Int` | $0 \le \text{Index} < 48$ | Chỉ số slot trong ngày |
| `day_of_week` | `Int` | $0 \le \text{DoW} \le 6$ | Ngày trong tuần (0: CN, 1: T2, ...) |
| `day_name` | `VarChar(16)` | Not Null | Tên thứ (Monday, Tuesday...) |
| `month` | `Int` | $1 \le \text{Month} \le 12$ | Tháng |
| `is_weekend` | `Boolean` | Not Null | Đánh dấu ngày cuối tuần |
| `checkin_count` | `Int` | $\ge 0$ | Tổng số lượt bệnh nhân tiếp đón trong slot |

---

## 3. Lược Đồ Tầng Gold Data Mart (Star Schema Serving Layer)

### 3.1. Bảng Sự Kiện: `fact_patient_journey` (Hành Trình Bệnh Nhân)
* **Mục đích:** Phân tích tổng thể trải nghiệm bệnh nhân, thời gian lưu viện (Length of Stay) và quy trình khám 3 bước $A \to B \to A'$.
* **Grain:** 1 dòng = 1 hành trình khám hoàn chỉnh.

| Cột (Column) | Kiểu dữ liệu | Vai trò | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `journey_key` | `String` | PK | Mã duy nhất của hành trình |
| `patient_key` | `String` | FK $\to$ `dim_patient` | Khóa bệnh nhân (Ẩn danh SHA-256) |
| `date_key` | `Int` | FK $\to$ `dim_date` | Ngày bắt đầu check-in (`YYYYMMDD`) |
| `time_slot_key` | `Int` | FK $\to$ `dim_time_slot` | Khung giờ tiếp nhận (`0..47`) |
| `intake_source` | `String` | Degenerate Dim | Nguồn tiếp đón (`KIOSK`, `STAFF_DESK`) |
| `severity_score` | `Int` | Measure | Điểm phân loại cấp cứu (1-5) |
| `total_tasks` | `Int` | Measure | Tổng số bước khám/xét nghiệm trong hành trình |
| `completed_tasks` | `Int` | Measure | Số bước đã hoàn tất |
| `has_a_b_return` | `Boolean` | Flag | Có trải qua quy trình $A \to B \to A'$ (Khám $\to$ Cận lâm sàng $\to$ Kết luận) |
| `total_wait_minutes` | `Float` | Measure | Tổng thời gian chờ đợi tích lũy (phút) |
| `total_service_minutes`| `Float` | Measure | Tổng thời gian ngồi khám/làm thủ thuật (phút) |
| `journey_duration_minutes`| `Float`| Measure | Tổng thời gian từ lúc Check-in đến khi Hoàn tất toàn bộ |
| `is_sla_breached` | `Boolean` | Flag | Có ít nhất 1 bước khám vi phạm chuẩn SLA |

---

### 3.2. Bảng Sự Kiện: `fact_task_execution` (Thực Thi Nhiệm Vụ Khám & Cận Lâm Sàng)
* **Mục đích:** Phân tích vi mô hiệu suất từng phòng, bác sĩ, thiết bị, phân vị thời gian chờ và vi phạm SLA.
* **Grain:** 1 dòng = 1 bước khám hoặc dịch vụ y tế.

| Cột (Column) | Kiểu dữ liệu | Vai trò | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `task_key` | `String` | PK | Mã nhiệm vụ |
| `journey_key` | `String` | FK $\to$ `fact_patient_journey` | Khóa hành trình |
| `patient_key` | `String` | FK $\to$ `dim_patient` | Khóa bệnh nhân ẩn danh |
| `doctor_key` | `String` | FK $\to$ `dim_doctor` | Khóa bác sĩ phụ trách |
| `room_key` | `String` | FK $\to$ `dim_clinic_room` | Khóa phòng khám/thủ thuật |
| `specialty_key` | `String` | FK $\to$ `dim_specialty` | Khóa chuyên khoa lâm sàng |
| `date_key` | `Int` | FK $\to$ `dim_date` | Ngày thực hiện (`YYYYMMDD`) |
| `time_slot_key` | `Int` | FK $\to$ `dim_time_slot` | Khung giờ 30 phút bắt đầu |
| `task_type` | `String` | Dimension | Loại bước (`INITIAL_CONSULT`, `DIAGNOSTIC_SERVICE`, `RETURN_REVIEW`) |
| `service_type` | `String` | Dimension | Loại dịch vụ (`CLINICAL_CONSULT`, `XRAY`, `ABDOMINAL_ULTRASOUND`...) |
| `clinical_priority` | `String` | Dimension | Mức ưu tiên (`EMERGENCY`, `URGENT`, `NORMAL`, `NON_URGENT`) |
| `status` | `String` | Dimension | Trạng thái kết thúc (`COMPLETED`, `CANCELLED`, `NO_SHOW`) |
| `operational_wait_minutes`| `Float`| Measure | Thời gian chờ từ lúc sẵn sàng đến khi được khám |
| `physical_wait_minutes` | `Float` | Measure | Thời gian chờ từ lúc đến vật lý |
| `service_duration_minutes`| `Float`| Measure | Thời gian bác sĩ/kỹ thuật viên thực hiện |
| `result_turnaround_minutes`| `Float`| Measure | Thời gian chờ trả kết quả xét nghiệm/CĐHA |
| `sla_target_minutes` | `Float` | Benchmark | Ngưỡng cam kết SLA theo mức ưu tiên |
| `is_sla_breach` | `Boolean` | Flag | `operational_wait_minutes > sla_target_minutes` |
| `queue_length_at_arrival` | `Int` | Measure | Độ dài hàng đợi tại thời điểm bệnh nhân đến |
| `resource_failure` | `Boolean` | Flag | Có sự cố hỏng hóc thiết bị/phòng trong ca |
| `emergency_insertion` | `Boolean` | Flag | Bị gián đoạn bởi ca cấp cứu chen ngang |

---

### 3.3. Các Bảng Chiều (Dimension Tables)

1. **`dim_patient`**:
   - `patient_key`: Khóa thay thế (Surrogate Key)
   - `patient_alias`: Chuỗi ẩn danh `P-xxxxxxxxxx` (SHA-256)
   - `age_group`: Nhóm tuổi (`<18`, `18-35`, `36-55`, `>55`)
   - `gender`: Giới tính

2. **`dim_doctor`**:
   - `doctor_key`: Mã bác sĩ (`D1`, `D2`...)
   - `full_name`: Tên bác sĩ
   - `role`: Vai trò (`DOCTOR`, `SPECIALIST`)

3. **`dim_clinic_room`**:
   - `room_key`: Mã phòng (`ROOM-CARD-201`...)
   - `room_name`: Tên phòng khám
   - `room_code`: Mã viết tắt (`TM-201`)
   - `floor`: Vị trí tầng (`Tầng 1`, `Tầng 2`...)
   - `department_name`: Tên khoa chủ quản

4. **`dim_specialty`**:
   - `specialty_key`: Mã chuyên khoa (`SPEC-CARD-CONSULT`...)
   - `specialty_name`: Tên chuyên khoa (12 chuyên khoa lâm sàng)
   - `department_id`: Mã khoa trực thuộc

5. **`dim_date`**:
   - `date_key`: Khóa ngày số nguyên `YYYYMMDD` (VD: `20260815`)
   - `full_date`: Định dạng `YYYY-MM-DD`
   - `day_of_week`: `0` (Chủ nhật) $\to$ `6` (Thứ bảy)
   - `day_name`: `Monday`, `Tuesday`...
   - `month`: `1` $\to$ `12`
   - `quarter`: `Q1` $\to$ `Q4`
   - `year`: `2026`
   - `is_weekend`: `true` / `false`

6. **`dim_time_slot`**:
   - `time_slot_key`: `0` $\to$ `47` (Tương ứng 48 khung 30 phút trong ngày)
   - `slot_start_time`: `08:00`, `08:30`...
   - `slot_end_time`: `08:30`, `09:00`...
   - `shift_period`: `MORNING` (07:00-11:30), `AFTERNOON` (13:00-17:00), `NIGHT` (17:00-22:00)

---
*Tài liệu này được biên soạn và bảo trì tự động bởi MedFlow Data Governance Engine.*
