# MedFlow Enterprise Data Dictionary & Data Governance Catalog
## DAMA-DMBOK Standardized Metadata Specification

Tài liệu Từ điển Dữ liệu và Danh mục Quản trị (Data Governance Catalog) cho hệ thống **MedFlow**, chuẩn hóa toàn diện cấu trúc cơ sở dữ liệu vận hành (OLTP Layer), mô hình dữ liệu đa chiều (Data Mart / Star Schema Layer), cùng hệ thống quy tắc kiểm soát chất lượng dữ liệu (Data Quality Rules).

---

## 1. OLTP Operational Data Layer (PostgreSQL / Prisma Schema)

### 1.1. `patients` (Bệnh nhân)
- **Mục đích nghiệp vụ:** Quản lý thông tin định danh hồ sơ bệnh nhân trong hệ thống khám chữa bệnh.
- **Grain:** 1 dòng = 1 bệnh nhân duy nhất.

| Tên trường (Column) | Kiểu dữ liệu | Khóa / Ràng buộc | Nullable | Mô tả nghiệp vụ & Quy tắc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(30)` | **PK** (cuid) | No | Định danh duy nhất bản ghi bệnh nhân nội bộ hệ thống |
| `identification_code` | `VARCHAR(50)` | **UNIQUE** | No | Mã định danh y tế / số CCCD / BHYT |
| `patient_token` | `VARCHAR(100)` | **UNIQUE, INDEX** | No | Khóa mã hóa bảo mật dùng để tra cứu hành trình khám |
| `full_name` | `VARCHAR(255)` | - | Yes | Họ và tên bệnh nhân (PII - không đưa vào Data Mart) |
| `phone_number` | `VARCHAR(20)` | - | Yes | Số điện thoại liên hệ (PII) |
| `date_of_birth` | `DATE` | - | Yes | Ngày tháng năm sinh |
| `status` | `ENUM` | Default: `ACTIVE` | No | Trạng thái hồ sơ: `ACTIVE`, `INACTIVE`, `MERGED` |
| `created_at` | `TIMESTAMPTZ(6)` | Default: `now()` | No | Thời điểm tạo hồ sơ |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto-updated | No | Thời điểm cập nhật hồ sơ gần nhất |

---

### 1.2. `patient_journeys` (Hành trình khám bệnh)
- **Mục đích nghiệp vụ:** Đại diện cho một lượt đến khám tổng thể của bệnh nhân tại bệnh viện (bao gồm chuỗi các bước khám, xét nghiệm, chẩn đoán hình ảnh và kết luận).
- **Grain:** 1 dòng = 1 lượt khám (Journey) của 1 bệnh nhân.

| Tên trường (Column) | Kiểu dữ liệu | Khóa / Ràng buộc | Nullable | Mô tả nghiệp vụ & Quy tắc |
| :--- | :--- | :--- | :--- | :--- |
| `journey_id` | `VARCHAR(50)` | **PK** | No | Mã định danh duy nhất của lượt khám bệnh |
| `patient_token` | `VARCHAR(100)` | **FK** $\to$ `patients`, **INDEX** | No | Mã token định danh bệnh nhân |
| `checkin_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm bệnh nhân hoàn tất tiếp nhận/check-in tại viện |
| `severity_score` | `INTEGER` | Check: `1 <= x <= 10` | Yes | Điểm đánh giá mức độ nặng ban đầu khi phân loại tiếp đón |
| `symptom_description`| `TEXT` | - | Yes | Mô tả triệu chứng lâm sàng dạng văn bản |
| `symptom_payload` | `JSONB` | - | Yes | Dữ liệu cấu trúc hóa các triệu chứng (đầu vào cho AI Router) |
| `symptoms_submitted_at`| `TIMESTAMPTZ(6)`| - | Yes | Thời điểm gửi dữ liệu triệu chứng lên hệ thống |
| `intake_source` | `ENUM` | - | Yes | Nguồn tiếp nhận: `PATIENT_SELF`, `STAFF_DESK`, `KIOSK` |
| `created_at` | `TIMESTAMPTZ(6)` | Default: `now()` | No | Thời điểm khởi tạo bản ghi hành trình |
| `updated_at` | `TIMESTAMPTZ(6)` | Auto-updated | No | Thời điểm cập nhật hành trình |

---

### 1.3. `patient_journey_tasks` (Nhiệm vụ khám / Dịch vụ cận lâm sàng)
- **Mục đích nghiệp vụ:** Bảng giao dịch trọng tâm (Core Fact Grain) ghi nhận từng công đoạn dịch vụ y tế cụ thể trong hành trình khám (Khám sơ bộ $\to$ Xét nghiệm/X-quang/Siêu âm $\to$ Khám lại kết luận).
- **Grain:** 1 dòng = 1 nhiệm vụ/dịch vụ y tế của một lượt khám.

| Tên trường (Column) | Kiểu dữ liệu | Khóa / Ràng buộc | Nullable | Mô tả nghiệp vụ & Quy tắc |
| :--- | :--- | :--- | :--- | :--- |
| `task_id` | `VARCHAR(50)` | **PK** | No | Mã định danh duy nhất của nhiệm vụ khám |
| `journey_id` | `VARCHAR(50)` | **FK** $\to$ `patient_journeys`, **INDEX** | No | Khóa ngoại tham chiếu hành trình cha |
| `journey_step` | `ENUM` | - | No | Bước khám: `INITIAL_CONSULT`, `DIAGNOSTIC_SERVICE`, `RESULT_PENDING`, `RETURN_REVIEW` |
| `parent_task_id` | `VARCHAR(50)` | **FK** $\to$ `patient_journey_tasks` | Yes | Mã nhiệm vụ gốc phát sinh ra dịch vụ này |
| `depends_on_task_id` | `VARCHAR(50)` | - | Yes | Mã nhiệm vụ tiền điều kiện phải hoàn thành trước |
| `patient_token` | `VARCHAR(100)` | **FK** $\to$ `patients`, **INDEX** | No | Mã token bệnh nhân |
| `department_id` | `VARCHAR(50)` | **FK** $\to$ `departments`, **INDEX** | Yes | Khoa phụ trách |
| `specialty_id` | `VARCHAR(50)` | **FK** $\to$ `clinical_specialties`, **INDEX** | Yes | Chuyên khoa phụ trách |
| `queue_id` | `VARCHAR(50)` | **FK** $\to$ `service_queues`, **INDEX** | Yes | Hàng đợi dịch vụ được chỉ định |
| `room_id` | `VARCHAR(50)` | **FK** $\to$ `clinic_rooms`, **INDEX** | Yes | Phòng khám / phòng xét nghiệm thực hiện |
| `task_type` | `ENUM` | - | No | Loại nhiệm vụ: `INITIAL_CONSULT`, `DIAGNOSTIC_SERVICE`, `RETURN_REVIEW` |
| `status` | `ENUM` | Default: `PENDING` | No | Trạng thái: `PENDING`, `READY`, `IN_QUEUE`, `IN_SERVICE`, `WAITING_RESULT`, `COMPLETED`, `CANCELLED`, `SKIPPED` |
| `service_type` | `ENUM` | - | No | Loại dịch vụ: `CLINICAL_CONSULT`, `XRAY`, `ABDOMINAL_ULTRASOUND`, `RESULT_REVIEW` |
| `clinical_priority` | `ENUM` | Default: `NORMAL` | No | Mức ưu tiên y khoa: `EMERGENCY`, `URGENT`, `NORMAL`, `NON_URGENT` |
| `readiness_status` | `ENUM` | - | Yes | Trạng thái sẵn sàng tiếp nhận: `COMPLETED`, `RESULT_PENDING` |
| `scheduling_mode` | `ENUM` | - | Yes | Chế độ xếp hàng: `FAIR_QUEUE`, `SCHEDULED_WINDOW` |
| `doctor_id` | `VARCHAR(50)` | **FK** $\to$ `staff_users`, **INDEX** | Yes | Bác sĩ trực tiếp phục vụ |
| `device_id` | `VARCHAR(50)` | **INDEX** | Yes | Mã thiết bị / máy xét nghiệm thực hiện |
| `assigned_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm phân bổ vào hàng đợi/phòng |
| `arrival_time` | `TIMESTAMPTZ(6)` | **INDEX** | Yes | Thời điểm bệnh nhân có mặt tại khu vực chờ của phòng |
| `ready_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm bệnh nhân đủ điều kiện gọi khám |
| `service_start` | `TIMESTAMPTZ(6)` | **INDEX** | Yes | Thời điểm bác sĩ/máy bắt đầu phục vụ |
| `service_end` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm kết thúc phục vụ |
| `completed_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm đánh dấu hoàn thành toàn bộ |
| `cancelled_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm hủy dịch vụ (nếu có) |
| `result_ready_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm có kết quả cận lâm sàng (Lab/PACS trả về) |
| `result_urgency` | `ENUM` | - | Yes | Mức độ khẩn cấp của kết quả: `NORMAL`, `URGENT` |
| `result_delay_minutes`| `DOUBLE PRECISION`| - | Yes | Số phút chậm trễ trả kết quả ngoài dự kiến |
| `return_timing` | `ENUM` | - | Yes | Phân loại thời điểm quay lại: `EARLY`, `ON_TIME`, `LATE` |
| `sequence_order` | `INTEGER` | - | Yes | Thứ tự thực hiện trong chuỗi hành trình |
| `queue_length` | `INTEGER` | - | Yes | Độ dài hàng đợi tại thời điểm phân bổ |
| `resource_failure` | `BOOLEAN` | Default: `false` | No | Cờ đánh dấu máy/thiết bị bị gián đoạn sự cố kỹ thuật |
| `actual_wait_time` | `DOUBLE PRECISION`| - | Yes | Thời gian chờ thực tế (phút) |
| `no_show` | `BOOLEAN` | Default: `false` | No | Cờ đánh dấu bệnh nhân vắng mặt khi được gọi |
| `emergency_insertion`| `BOOLEAN` | Default: `false` | No | Cờ đánh dấu bị ca cấp cứu chen ngang hàng đợi |

---

### 1.4. `patient_task_dependencies` (Ràng buộc thứ tự nhiệm vụ - DAG)
- **Mục đích nghiệp vụ:** Quản lý đồ thị phụ thuộc (Directed Acyclic Graph) giữa các nhiệm vụ trong một hành trình khám.
- **Grain:** 1 dòng = 1 mối quan hệ phụ thuộc giữa 2 nhiệm vụ.

| Tên trường (Column) | Kiểu dữ liệu | Khóa / Ràng buộc | Nullable | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | **PK** (autoincrement) | No | Khóa chính tự tăng |
| `task_id` | `VARCHAR(50)` | **FK** $\to$ `patient_journey_tasks` | No | Nhiệm vụ bị chặn (bước sau) |
| `depends_on_task_id` | `VARCHAR(50)` | **FK** $\to$ `patient_journey_tasks` | No | Nhiệm vụ điều kiện (bước trước phải xong) |
| `created_at` | `TIMESTAMPTZ(6)` | Default: `now()` | No | Thời điểm thiết lập quan hệ |

---

### 1.5. `patient_queue_entries` (Bản ghi xếp hàng thời gian thực)
- **Mục đích nghiệp vụ:** Quản lý vị trí số thứ tự và vòng đời của bệnh nhân trong hàng đợi cụ thể.
- **Grain:** 1 dòng = 1 lượt xếp hàng vào 1 queue.

| Tên trường (Column) | Kiểu dữ liệu | Khóa / Ràng buộc | Nullable | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(30)` | **PK** (cuid) | No | Khóa chính |
| `queue_id` | `VARCHAR(50)` | **FK** $\to$ `service_queues` | No | Mã hàng đợi |
| `taskId` | `VARCHAR(50)` | **FK** $\to$ `patient_journey_tasks` | No | Mã nhiệm vụ khám tương ứng |
| `status` | `ENUM` | Default: `WAITING` | No | Trạng thái xếp hàng: `WAITING`, `CALLED`, `IN_SERVICE`, `DONE`, `CANCELLED`, `NO_SHOW` |
| `priority` | `ENUM` | Default: `NORMAL` | No | Mức ưu tiên tại hàng đợi |
| `queue_number` | `INTEGER` | - | Yes | Số thứ tự in trên phiếu hàng đợi |
| `position` | `INTEGER` | - | Yes | Vị trí hiện tại trong danh sách chờ |
| `enqueued_at` | `TIMESTAMPTZ(6)` | Default: `now()` | No | Thời điểm cấp số vào hàng đợi |
| `called_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm loa/màn hình gọi tên vào phòng |
| `service_start_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm bắt đầu vào phục vụ |
| `service_end_at` | `TIMESTAMPTZ(6)` | - | Yes | Thời điểm phục vụ xong |

---

### 1.6. `clinic_rooms` (Phòng khám & Phòng cận lâm sàng)
- **Mục đích nghiệp vụ:** Quản lý cơ sở vật chất phòng ban thực hiện dịch vụ y tế.
- **Grain:** 1 dòng = 1 phòng khám/xét nghiệm.

| Tên trường (Column) | Kiểu dữ liệu | Khóa / Ràng buộc | Nullable | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | **PK** | No | Mã phòng khám (vd: `ROOM-101`) |
| `specialty_id` | `VARCHAR(50)` | **FK** $\to$ `clinical_specialties` | No | Chuyên khoa sở hữu phòng |
| `doctor_id` | `VARCHAR(50)` | **FK** $\to$ `staff_users` | Yes | Bác sĩ trưởng phòng phụ trách mặc định |
| `name` | `VARCHAR(255)` | - | No | Tên phòng (vd: Phòng Khám Nội 1) |
| `code` | `VARCHAR(50)` | **UNIQUE** | Yes | Mã viết tắt của phòng |
| `floor` | `VARCHAR(20)` | - | Yes | Vị trí tầng lầu (phục vụ tính khoảng cách di chuyển) |
| `is_active` | `BOOLEAN` | Default: `true` | No | Cờ hoạt động |

---

### 1.7. `clinical_specialties` & `departments` (Chuyên khoa & Khối khoa)
- **`departments`:** Quản lý các khối khoa viện (`id`, `name`, `code`, `is_active`).
- **`clinical_specialties`:** Quản lý 12 chuyên khoa lâm sàng (`id`, `department_id` **FK**, `name`, `code`, `is_active`).

---

### 1.8. `staff_users` & `doctor_room_assignments` (Nhân sự y tế & Phân ca trực)
- **`staff_users`:** Quản lý tài khoản bác sĩ, điều dưỡng, nhân viên tiếp đón (`id`, `username`, `full_name`, `role`, `status`).
- **`doctor_room_assignments`:** Bảng ghi nhận lịch phân bổ bác sĩ vào từng phòng khám theo ca (`id`, `doctor_id`, `room_id`, `role`, `status`, `shift_start`, `shift_end`).

---

### 1.9. `hospital_edges` & `equipments` (Đồ thị di chuyển & Thiết bị y tế)
- **`hospital_edges`:** Bảng trọng số khoảng cách/thời gian di chuyển giữa các phòng khám (`from_room_id`, `to_room_id`, `travel_minutes`).
- **`equipments`:** Quản lý máy móc thiết bị chẩn đoán (`id`, `name`, `code`, `room_id`, `status: ACTIVE/INACTIVE`).

---

### 1.10. `checkin_slot_statistics` (Thống kê lưu lượng tiếp đón theo khung giờ)
- Quản lý số lượng bệnh nhân đến khám tổng hợp theo khung thời gian 30 phút phục vụ dự báo nhu cầu (`checkin_time`, `date`, `slot_start`, `slot_index`, `day_of_week`, `is_weekend`, `checkin_count`).

---

## 2. Gold Layer: Star Schema Dimensional Model (Data Mart)

### 2.1. Fact Tables

#### `fact_task_execution` (Fact Thực thi Dịch vụ Khám & Xét nghiệm)
- **Grain:** 1 dòng = 1 lần thực thi nhiệm vụ khám hoặc cận lâm sàng.
- **Measures (Chỉ số định lượng):**
  - `operational_wait_minutes`: Thời gian chờ từ lúc sẵn sàng đến lúc bắt đầu phục vụ.
  - `physical_wait_minutes`: Thời gian chờ từ lúc có mặt đến lúc bắt đầu phục vụ.
  - `service_duration_minutes`: Thời lượng phục vụ của bác sĩ/thiết bị.
  - `result_turnaround_minutes`: Thời gian từ lúc làm xong xét nghiệm đến khi có kết quả trả về.
  - `is_sla_breach`: Cờ vi phạm SLA quy định (1 = Vi phạm, 0 = Đạt chuẩn).
  - `resource_failure_flag`: Cờ ghi nhận sự cố gián đoạn thiết bị (1/0).
  - `emergency_insertion_flag`: Cờ bị ca cấp cứu chen ngang (1/0).

#### `fact_patient_journey` (Fact Tổng thể Hành trình Khám)
- **Grain:** 1 dòng = 1 lượt hành trình của bệnh nhân từ lúc vào viện đến lúc ra viện.
- **Measures (Chỉ số định lượng):**
  - `journey_duration_minutes`: Tổng thời gian hoàn tất toàn bộ hành trình.
  - `total_operational_wait_minutes`: Tổng thời gian chờ cộng dồn qua tất cả các bước.
  - `total_service_minutes`: Tổng thời gian thực tế được phục vụ trực tiếp.
  - `task_count`: Tổng số bước/nhiệm vụ trong hành trình.
  - `has_a_b_return`: Cờ hành trình luồng 3 bước (Khám đầu $\to$ Cận lâm sàng $\to$ Khám lại).

---

### 2.2. Dimension Tables
- **`dim_patient`:** `patient_key` (PK), `patient_alias` (SHA-256 Masked), `age_group`, `status`.
- **`dim_doctor`:** `doctor_key` (PK), `doctor_id`, `doctor_name`, `role`, `status`.
- **`dim_clinic_room`:** `clinic_room_key` (PK), `room_id`, `room_name`, `room_code`, `floor`, `is_active`.
- **`dim_specialty`:** `specialty_key` (PK), `specialty_id`, `specialty_name`, `department_name`.
- **`dim_date`:** `date_key` (PK, YYYYMMDD), `full_date`, `day_of_week`, `day_name`, `month`, `quarter`, `year`, `is_weekend`.
- **`dim_time_slot`:** `time_slot_key` (PK), `slot_label` (vd: "08:00 - 08:30"), `slot_index_30m`, `hour_of_day`, `is_peak_hour`.

---

## 3. Data Quality Rules Catalog (15+ Tiêu chí Kiểm soát)

| Mã Rule | Tên kiểm tra (Check Name) | Mức độ | Điều kiện logic xác thực (Assertion) |
| :--- | :--- | :--- | :--- |
| **DQ-01** | `unique_task_id` | CRITICAL | $\text{Count(task\_id)} = \text{Count(Distinct task\_id)}$ |
| **DQ-02** | `mandatory_identifiers` | CRITICAL | $\text{task\_id, journey\_id, patient\_alias NOT NULL}$ |
| **DQ-03** | `no_raw_pii_exposure` | CRITICAL | Bắt buộc `patient_token` thô không xuất hiện ở Silver/Gold layer |
| **DQ-04** | `non_negative_wait_time` | HIGH | $\text{operational\_wait\_minutes} \ge 0$ |
| **DQ-05** | `non_negative_service_duration` | CRITICAL | $\text{service\_duration\_minutes} \ge 0$ ($\text{service\_end} \ge \text{service\_start}$) |
| **DQ-06** | `chronological_order` | HIGH | $\text{checkin\_at} \le \text{arrival\_time} \le \text{ready\_at} \le \text{service\_start} \le \text{service\_end}$ |
| **DQ-07** | `valid_clinical_priority` | MEDIUM | $\text{clinical\_priority} \in \{\text{'EMERGENCY'}, \text{'URGENT'}, \text{'NORMAL'}, \text{'NON\_URGENT'}\}$ |
| **DQ-08** | `valid_readiness_status` | HIGH | $\text{readiness\_status} \in \{\text{'WAITING'}, \text{'READY'}, \text{'IN\_SERVICE'}, \text{'COMPLETED'}, \dots\}$ |
| **DQ-09** | `resource_attribution` | HIGH | Nếu $\text{service\_start IS NOT NULL} \implies (\text{doctor\_id IS NOT NULL} \lor \text{device\_id IS NOT NULL})$ |
| **DQ-10** | `timestamp_provenance_integrity` | HIGH | $\text{actual\_timestamp} \neq \text{estimated\_timestamp}$ (phân biệt nguồn gốc) |
| **DQ-11** | `acyclic_task_graph` | CRITICAL | Đồ thị phụ thuộc `patient_task_dependencies` không chứa chu trình |
| **DQ-12** | `journey_duration_upper_bound` | HIGH | $\text{journey\_completion\_minutes} \le 1440$ (24 giờ) |
| **DQ-13** | `service_duration_outlier_cap` | MEDIUM | $\text{service\_duration\_minutes} \le 180$ (3 giờ) |
| **DQ-14** | `valid_foreign_keys` | HIGH | Mọi khóa ngoại `room_id, specialty_id, doctor_id` phải tồn tại trong Dimension |
| **DQ-15** | `timezone_conformance` | HIGH | Toàn bộ dấu thời gian được chuẩn hóa chính xác sang `Asia/Ho_Chi_Minh` |
| **DQ-16** | `queue_length_non_negative` | MEDIUM | $\text{queue\_length} \ge 0$ |
