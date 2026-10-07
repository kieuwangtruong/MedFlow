# Kiến trúc Kỹ thuật Hệ thống Medi-Flow AI (Architecture Blueprint)

Tài liệu đặc tả toàn diện kiến trúc kỹ thuật của hệ sinh thái **Medi-Flow AI**, bao gồm:
1. **Kiến trúc Microservices Phân tán (Distributed Microservices Architecture)**
2. **Sơ đồ Quan hệ Thực thể (ERD) Cơ sở Dữ liệu Vận hành OLTP**
3. **Lược đồ Hình sao (Star Schema) của Data Mart Phân tích Luồng Bệnh nhân (OLAP)**
4. **Quy trình Điều phối & Luồng Dữ liệu Phân tán (Distributed Sequence Workflow)**

---

## 1. Kiến trúc Microservices Phân tán (Distributed Microservices Architecture)

Medi-Flow AI áp dụng mô hình phân tầng enterprise (Multi-Tier Architecture), tách bạch rạch ròi giữa hệ thống vận hành khám bệnh thời gian thực (**OLTP**) và cụm mô hình phân tích tối ưu hóa trí tuệ nhân tạo (**AI/OLAP**).

```mermaid
flowchart TB
    %% Presentation Tier
    subgraph ClientTier["1. PRESENTATION TIER (Cổng Đa Kênh)"]
        P_PORTAL["Cổng Bệnh Nhân Web<br/>(Mobile / Responsive React 19)"]
        D_PORTAL["Cổng Bác Sĩ & Điều Dưỡng<br/>(Desktop EMR Workspace)"]
        K_PORTAL["Kiosk Tự Phục Vụ<br/>(Cửa Phòng / Tiếp Đón Check-in)"]
        ADMIN_PORTAL["Trung Tâm Điều Hành<br/>(Executive Operations Hub)"]
    end

    %% API Gateway & Backend
    subgraph GatewayTier["2. API GATEWAY & BUSINESS CORE (Node.js / Express 5)"]
        AUTH_MOD["Auth & RBAC Module<br/>(Stateless JWT / Bcrypt / Zod)"]
        TRIAGE_ENGINE["ESI Triage Engine<br/>(5 Cấp độ Ưu tiên Lâm sàng)"]
        HIS_STATEMACHINE["Clinical Workflow State Machine<br/>(Chu trình A -> B -> A' & Priority Bump)"]
        AI_GATEWAY["Resilient AI Gateway Client<br/>(Circuit Breaker & Rule Fallback)"]
        PRISMA_ORM["Prisma ORM & Driver Adapter<br/>(PostgreSQL Connection Pool)"]
    end

    %% AI Cluster
    subgraph AICLuster["3. AI COGNITIVE & OPTIMIZATION CLUSTER (FastAPI / Python 3.12)"]
        subgraph NLP_MODULE["Symptom Routing Service"]
            NLP_ROUTER["Semantic Symptom Parser<br/>(Cosine / Multi-label Classifier)"]
            ICD_MAPPER["ICD-10 & Chuyên Khoa Mapper"]
        end
        subgraph QUEUE_MODULE["Wait-Time & Simulation Engine"]
            DISCRETE_SIM["Discrete-Event Queue Simulator<br/>(Hàng Đợi Trạng Thái Động)"]
            MONTE_CARLO["Monte Carlo Duration Engine<br/>(Ước lượng P50 / P80 / P90)"]
            OCC_GUARD["Optimistic Concurrency Control<br/>(Quote Versioning & State Guard)"]
        end
        subgraph FORECAST_MODULE["Peak Hour Predictor"]
            PEAK_MODEL["Time-Series Peak Forecaster<br/>(Dự Báo Quá Tải Cục Bộ 60p)"]
        end
    end

    %% Persistence Tier
    subgraph DataTier["4. OPERATIONAL PERSISTENCE (OLTP)"]
        NEON_DB[("PostgreSQL trên Neon Cloud<br/>- Users & Staffs<br/>- Patients & Encounters<br/>- Queue Tasks & Orders<br/>- Event Journal & Audit Logs")]
    end

    %% Analytics & BI Platform
    subgraph AnalyticsTier["5. DATA PLATFORM & BI INTELLIGENCE (OLAP)"]
        BRONZE_LAYER[("Bronze Layer<br/>Raw Ingestion Data")]
        SILVER_LAYER[("Silver Layer<br/>Cleansed & HIPAA De-identified")]
        GOLD_MART[("Gold Layer<br/>Star Schema Data Mart")]
        STREAMLIT_APP["Executive Analytics Control Center<br/>(Streamlit 4-Page O-I-A Dashboard)"]
    end

    %% Communication Flows
    ClientTier -->|HTTPS / REST / JSON| GatewayTier
    
    GatewayTier -->|HTTP REST / Retry Policy| AICLuster
    GatewayTier -->|PostgreSQL Connection Pool| DataTier
    
    DataTier -.->|Incremental ETL / Batch Extract| BRONZE_LAYER
    BRONZE_LAYER --> SILVER_LAYER --> GOLD_MART --> STREAMLIT_APP
```

### Các Đặc Tính Phân Tán Cốt Lõi:
* **Khả năng chịu lỗi (Resilience & Circuit Breaker):** Backend Node.js và Cụm AI Python được kết nối lỏng (Loosely Coupled). Khi AI Microservice gặp mã lỗi `404/502` hoặc quá tải, Gateway tự động kích hoạt bộ luật lâm sàng dự phòng nội bộ (Rule-based Fallback) đưa bệnh nhân vào phòng khám an toàn mà không làm gián đoạn hệ thống.
* **Kiểm soát đồng thời lạc quan (Optimistic Concurrency Control - OCC):** Cụm hàng đợi AI phát hành phiên bản báo giá `estimate_version` cho mỗi đề xuất. Nếu trạng thái phòng thay đổi trước khi xác nhận gán buồng, hệ thống trả về mã `409 REQUOTE_REQUIRED` để tránh xung đột tải.
* **Bảo mật phi trạng thái (Stateless Security):** Giao tiếp giữa Client và Gateway thông qua Bearer JWT Token được ký mật mã; mật khẩu nhân viên được hash bằng PBKDF2/Bcrypt.

---

## 2. Sơ đồ Quan hệ Thực thể (ERD) Cơ sở Dữ liệu Vận hành OLTP

Hệ thống OLTP quản trị thông tin lâm sàng trên **PostgreSQL (Neon)** thông qua **Prisma ORM**, đảm bảo chuẩn hóa dữ liệu (3NF) và tính toàn vẹn tham chiếu nghiêm ngặt:

```mermaid
erDiagram
    STAFF_USER ||--o{ CLINIC_ROOM : "phụ trách (assigned)"
    STAFF_USER ||--o{ DOCTOR_ROOM_ASSIGNMENT : "lịch trực (shifts)"
    
    DEPARTMENT ||--|{ CLINICAL_SPECIALTY : "bao gồm (contains)"
    CLINICAL_SPECIALTY ||--|{ CLINIC_ROOM : "thuộc chuyên khoa"
    
    CLINIC_ROOM ||--|{ SERVICE_QUEUE : "quản lý hàng đợi"
    CLINIC_ROOM ||--o{ DOCTOR_ROOM_ASSIGNMENT : "phân công ca"
    
    PATIENT ||--o{ PATIENT_JOURNEY : "có lượt khám (encounters)"
    
    PATIENT_JOURNEY ||--|{ PATIENT_JOURNEY_TASK : "gồm các bước khám"
    
    SERVICE_QUEUE ||--o{ PATIENT_QUEUE_ENTRY : "chứa số thứ tự"
    PATIENT_JOURNEY_TASK ||--o{ PATIENT_QUEUE_ENTRY : "gán vé hàng đợi"
    
    PATIENT_JOURNEY_TASK ||--o{ PATIENT_TASK_DEPENDENCY : "phụ thuộc nhiệm vụ (DAG)"

    STAFF_USER {
        string id PK
        string username UK
        string password_hash
        string full_name
        enum role "ADMIN, DOCTOR, NURSE, RECEPTIONIST"
        enum status "ACTIVE, INACTIVE"
        timestamptz last_login_at
    }

    DEPARTMENT {
        string id PK
        string name
        string code UK
        boolean is_active
    }

    CLINICAL_SPECIALTY {
        string id PK
        string department_id FK
        string name
        string code UK
        boolean is_active
    }

    CLINIC_ROOM {
        string id PK
        string specialty_id FK
        string doctor_id FK
        string name
        string code UK
        string floor
        boolean is_active
    }

    DOCTOR_ROOM_ASSIGNMENT {
        string id PK
        string doctor_id FK
        string room_id FK
        enum role "PRIMARY, SUPPORT, COVERING"
        enum status "SCHEDULED, ACTIVE, ENDED"
        timestamptz shift_start
        timestamptz shift_end
    }

    SERVICE_QUEUE {
        string id PK
        string room_id FK
        enum service_type "CLINICAL_CONSULT, XRAY, ULTRASOUND, RESULT_REVIEW"
        float estimated_wait_minutes
        boolean is_active
    }

    PATIENT {
        string id PK
        string identification_code UK "CCCD"
        string patient_token UK
        string full_name
        string phone_number
        date date_of_birth
        enum status "ACTIVE, INACTIVE"
    }

    PATIENT_JOURNEY {
        string journey_id PK
        string patient_token FK
        timestamptz checkin_at
        int severity_score "1-5 ESI"
        string symptom_description
        json symptom_payload
        string initial_room_id FK
        string current_room_id FK
        string queue_status "WAITING_EXAM, WAITING_REVIEW, COMPLETED"
    }

    PATIENT_JOURNEY_TASK {
        string task_id PK
        string journey_id FK
        string patient_token FK
        string room_id FK
        string origin_room_id
        enum task_type "INITIAL_CONSULT, DIAGNOSTIC_SERVICE, RETURN_REVIEW"
        enum status "PENDING, IN_QUEUE, IN_SERVICE, WAITING_RESULT, COMPLETED"
        enum clinical_priority "EMERGENCY, URGENT, NORMAL, NON_URGENT"
        timestamptz arrival_time
        timestamptz service_start
        timestamptz service_end
        timestamptz result_ready_at
        float actual_wait_time
        boolean emergency_insertion
    }

    PATIENT_QUEUE_ENTRY {
        string id PK
        string queue_id FK
        string task_id FK
        int queue_number "Số thứ tự gọi"
        int position "Vị trí trong hàng"
        enum priority "EMERGENCY, URGENT, NORMAL"
        boolean is_priority_bump "Cờ ưu tiên ca trả kết quả CLS"
        enum status "WAITING, CALLED, IN_SERVICE, DONE"
        timestamptz enqueued_at
        timestamptz called_at
    }

    PATIENT_TASK_DEPENDENCY {
        int id PK
        string task_id FK "Task bị chặn"
        string depends_on_task_id FK "Task điều kiện tiên quyết"
    }
```

---

## 3. Lược Đồ Hình Sao (Star Schema) Của Data Mart Phân Tích Luồng Bệnh Nhân

Tầng dữ liệu phân tích (**Gold Layer**) được mô hình hóa theo dạng **Star Schema**, tối ưu hóa cho các truy vấn OLAP, báo cáo BI thời gian thực trên Streamlit và mô hình hóa DAX trên Power BI:

```mermaid
erDiagram
    DIM_DATE ||--o{ FACT_TASK_EXECUTION : "ngày diễn ra (date_key)"
    DIM_TIME_SLOT ||--o{ FACT_TASK_EXECUTION : "khung giờ 30p (time_slot_key)"
    DIM_PATIENT ||--o{ FACT_TASK_EXECUTION : "bệnh nhân ẩn danh"
    DIM_DOCTOR ||--o{ FACT_TASK_EXECUTION : "bác sĩ phụ trách"
    DIM_CLINIC_ROOM ||--o{ FACT_TASK_EXECUTION : "buồng khám/phòng máy"
    DIM_SPECIALTY ||--o{ FACT_TASK_EXECUTION : "chuyên khoa"

    DIM_DATE ||--o{ FACT_PATIENT_JOURNEY : "ngày check-in (date_key)"
    DIM_PATIENT ||--o{ FACT_PATIENT_JOURNEY : "hành trình bệnh nhân"
    DIM_CLINIC_ROOM ||--o{ FACT_PATIENT_JOURNEY : "phòng tiếp nhận đầu tiên"

    DIM_PATIENT {
        string patient_key PK "P-xxxxxxxxxx (SHA-256 Hasher)"
        string patient_alias "Mã ẩn danh HIPAA"
        string anonymization_method "SHA-256 Salted Truncated"
    }

    DIM_DOCTOR {
        string doctor_key PK
        string doctor_id
        string doctor_name
        string role "DOCTOR, SPECIALIST"
    }

    DIM_CLINIC_ROOM {
        string room_key PK
        string room_name
        string department_name
        boolean is_active
    }

    DIM_SPECIALTY {
        string specialty_key PK
        string specialty_name
        string department_name
    }

    DIM_DATE {
        int date_key PK "YYYYMMDD"
        string full_date_str "YYYY-MM-DD"
        int year
        string quarter "Q1-Q4"
        int month
        string month_name
        int day_of_month
        int day_of_week "0-6"
        string day_name
        boolean is_weekend
    }

    DIM_TIME_SLOT {
        int time_slot_key PK "0-47"
        string slot_start_time "HH:MM"
        string slot_end_time "HH:MM"
        string slot_label "08:00 - 08:30"
        string shift_period "MORNING, AFTERNOON, EVENING, NIGHT"
    }

    FACT_TASK_EXECUTION {
        string task_id PK
        string journey_id FK
        string patient_key FK
        string doctor_key FK
        string room_key FK
        string specialty_key FK
        int date_key FK
        int time_slot_key FK
        string task_type "INITIAL_CONSULT, DIAGNOSTIC, RETURN_REVIEW"
        string clinical_priority "EMERGENCY, URGENT, NORMAL"
        float operational_wait_minutes "Thời gian chờ thực tế"
        float physical_wait_minutes "Thời gian chờ vật lý"
        float service_duration_minutes "Thời lượng khám/làm CLS"
        float result_turnaround_minutes "Thời gian trả kết quả"
        float sla_target_minutes "Ngưỡng SLA cam kết"
        boolean is_sla_breach "Cờ vi phạm SLA"
        int queue_length_at_arrival "Độ dài hàng đợi lúc đến"
        boolean emergency_insertion "Bị ca cấp cứu chen ngang"
    }

    FACT_PATIENT_JOURNEY {
        string journey_id PK
        string patient_key FK
        int date_key FK
        string initial_room_key FK
        string final_room_key FK
        int total_steps "Tổng số bước khám"
        float total_journey_minutes "Tổng thời gian lưu viện (LOS)"
        float total_wait_minutes "Tổng thời gian chờ"
        float total_service_minutes "Tổng thời gian phục vụ"
        boolean has_paraclinical_loop "Hành trình khép kín A -> B -> A'"
        boolean is_sla_breach_any "Có bất kỳ bước nào vi phạm SLA"
        string final_status "COMPLETED, CANCELLED"
    }
```

---

## 4. Chu Trình Điều Phối Khép Kín $A \to B \to A'$ (Sequence Diagram)

Quy trình giải quyết triệt để nút thắt cổ chai lớn nhất trong bệnh viện: **Bệnh nhân sau khi làm cận lâm sàng quay lại đọc kết quả được hệ thống tự động ưu tiên (Priority Bump), không phải xếp hàng lại từ đầu**:

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Bệnh Nhân (Kiosk / Web)
    participant GW as Backend API Gateway
    participant AI as AI Engine (NLP & Wait-Time)
    participant DB as PostgreSQL (Neon)
    actor Doctor as Bác Sĩ Khám Bệnh

    %% 1. Check-in & Routing
    Patient->>GW: 1. POST /patient/checkin (CCCD + Triệu chứng)
    GW->>AI: 2. Phân tích triệu chứng & ước lượng P50/P80/P90
    AI-->>GW: Trả về: Chuyên khoa + Danh sách phòng khám hợp lệ
    GW->>DB: 3. Tạo Journey & Gán hàng đợi buồng khám (A)
    GW-->>Patient: 4. Cấp phiếu STT + Phòng khám + ETA dự kiến

    %% 2. Initial Consultation
    Doctor->>GW: 5. Gọi khám (START_CONSULTATION)
    GW->>DB: Cập nhật task -> IN_PROGRESS
    Doctor->>GW: 6. Chỉ định Xét nghiệm / X-quang (CREATE_ORDERS)
    GW->>DB: Tạo sub-tasks CLS (WAITING_PARACLINICAL tại phòng B)
    
    %% 3. Paraclinical Execution & Priority Bump Return
    Note over GW,DB: Bệnh nhân thực hiện xong Xét nghiệm / X-quang tại buồng B
    GW->>DB: 7. Atomic Transaction: Kích hoạt PRIORITY_BUMP -> WAITING_REVIEW tại buồng A
    Doctor->>GW: 8. Gọi bệnh nhân ưu tiên trả kết quả (Priority Bump)
    Doctor->>GW: 9. Kê đơn & Kết luận khám bệnh (COMPLETE_ENCOUNTER)
    GW->>DB: Cập nhật trạng thái lượt khám -> COMPLETED
    GW-->>Patient: 10. Hoàn tất hành trình khám bệnh
```

---

*MedFlow Distributed Healthcare Architecture Blueprint © 2026.*  
*Tuân thủ tiêu chuẩn DAMA-DMBOK Framework & HIPAA De-identification Standards.*
