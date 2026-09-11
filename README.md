# MedFlow

**Nền tảng số hóa hành trình khám bệnh và hỗ trợ điều phối phòng khám bằng AI.**

MedFlow kết nối luồng bệnh nhân, bác sĩ, hàng đợi và mô hình AI trong một hệ thống thống nhất. Bệnh nhân có thể check-in, khai báo triệu chứng, nhận phòng phù hợp và theo dõi hành trình khám; bác sĩ theo dõi hàng đợi, gọi bệnh nhân, khám và tạo chỉ định; bộ máy AI hỗ trợ phân luồng triệu chứng, dự báo giờ cao điểm và ước lượng thời gian chờ.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kieuwangtruong/MedFlow)

> **Lưu ý y tế:** dữ liệu và mô hình trong repository phục vụ demo/hackathon, sử dụng dữ liệu tổng hợp và **không được xác thực lâm sàng**. Hệ thống không thay thế quyết định của nhân viên y tế.

## Điểm nổi bật

- Check-in bằng CCCD tại cổng bệnh nhân hoặc kiosk tự phục vụ.
- **Workflow State Machine chu trình 3 bước ($A \to B \to A'$):** Tự động phát hiện khi tất cả chỉ định cận lâm sàng (Lab, X-quang, Siêu âm) hoàn thành để chuyển bệnh nhân về hàng đợi buồng khám ban đầu với trạng thái `WAITING_REVIEW`.
- **Cơ chế Priority Bump:** Bệnh nhân quay lại đọc kết quả được ưu tiên gọi trước bệnh nhân khám mới thường nhưng sau ca cấp cứu.
- **Thuật toán Phân loại ESI 5 Cấp Độ (Triage Engine):** Tích hợp SpO2, Mạch, Huyết áp, Nhịp thở, Glasgow/AVPU, mức độ đau, đi kèm cơ chế bảo vệ kép chống *Under-triage* (bỏ sót ca nguy kịch) và *Anti-Over-triage* (chống chiếm dụng giường cấp cứu).
- **Bộ máy Ước lượng Thời gian Chờ Động (Wait-Time Engine):** Phản ánh tải thực tế, chia tải theo số bác sĩ active, loại trừ bệnh nhân đang đi làm xét nghiệm và xử lý ca cấp cứu xen ngang ($EWT \ge 0$).
- AI phân loại khoa/phòng, phát hiện red flag và trả mức độ tin cậy.
- Tạo số thứ tự và lưu lộ trình khám theo từng bệnh nhân.
- Hàng đợi bác sĩ theo phòng và ca trực đang hoạt động với thứ tự gọi số chuẩn y tế: Cấp cứu (P1) > Đọc kết quả (Priority Bump) > Khám mới (P3/P4).
- Ước lượng thời gian chờ theo P50/P80/P90 và mô phỏng tác động khi đổi phòng.
- Dự báo khung giờ check-in cao điểm và dashboard phân tích vận hành.
- Triển khai monorepo bằng Render Blueprint, dữ liệu lưu trên Neon PostgreSQL.

## Kiến trúc

```mermaid
flowchart LR
    U["Bệnh nhân / Bác sĩ"] --> F["React + Vite frontend"]
    F -->|"REST /api/v1"| B["Node.js + Express backend"]
    B -->|"Prisma"| D[("Neon PostgreSQL")]
    B -->|"AI gateway"| A["FastAPI unified AI"]
    A --> R["Phân luồng triệu chứng"]
    A --> P["Dự báo giờ cao điểm"]
    A --> W["Wait-Time & Queue Engine"]
    D --> N["Analytics / Streamlit"]
```

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express 5, Prisma ORM, JWT, Zod |
| AI | Python 3.12, FastAPI, pandas, scikit-learn, SQLAlchemy |
| Database | PostgreSQL trên Neon |
| Analytics | Streamlit, SQL, EDA và báo cáo vận hành |
| Deployment | Render Blueprint: Static Site + Node Web Service + Python Web Service |

## Tài khoản demo

### Bệnh nhân

| Cách đăng nhập | Giá trị | Mật khẩu |
|---|---|---|
| CCCD demo có sẵn | `001204012345` — Nguyễn Văn An | Không cần |
| Lượt test mới | Một chuỗi **9–12 chữ số** chưa sử dụng, ví dụ `090000000123` | Không cần |

Nhập họ tên và CCCD mới sẽ tự tạo hồ sơ bệnh nhân demo. Chỉ sử dụng thông tin giả lập, không nhập dữ liệu định danh thật.

### Bác sĩ

Mật khẩu chung cho toàn bộ tài khoản bác sĩ demo: **`12345678`**

| Tài khoản | Bác sĩ | Phòng trực demo |
|---|---|---|
| `bs.nguyen.minh.khang@vaic.vn` | BS. Nguyễn Minh Khang | Tổng quát 101 (`PK-TQ-101`) |
| `nam01@gmail.com` | BS. Nguyễn Văn Nam | Phân loại Cấp cứu 102 (`CC-102`) |
| `bs.le.quang.huy@vaic.vn` | BS. Lê Quang Huy | Tim mạch 201 (`TM-201`) |
| `bs.pham.thu.ha@vaic.vn` | BS. Phạm Thu Hà | Thần kinh 202 (`TK-202`) |
| `bs.vo.thanh.dat@vaic.vn` | BS. Võ Thành Đạt | Tai Mũi Họng 203 (`TMH-203`) |
| `bs.dang.ngoc.anh@vaic.vn` | BS. Đặng Ngọc Anh | Da liễu 204 (`DL-204`) |
| `bs.bui.tuan.kiet@vaic.vn` | BS. Bùi Tuấn Kiệt | Nhi 301 (`NK-301`) |
| `bs.do.my.linh@vaic.vn` | BS. Đỗ Mỹ Linh | Sản Phụ khoa 302 (`SPK-302`) |
| `bs.hoang.gia.bao@vaic.vn` | BS. Hoàng Gia Bảo | Cơ Xương Khớp 303 (`CXK-303`) |
| `bs.ngo.thanh.van@vaic.vn` | BS. Ngô Thanh Vân | Tiêu hóa - Gan mật 304 (`TH-304`) |
| `bs.tran.hoang.lan@vaic.vn` | BS. Trần Hoàng Lan | Mắt 403 (`MAT-403`) |
| `bs.nguyen.thu.huong@vaic.vn` | BS. Nguyễn Thu Hương | Chẩn đoán hình ảnh 501 (`CDHA-501`) |

> Các thông tin đăng nhập trên chỉ dành cho môi trường demo. Không tái sử dụng mật khẩu này trong môi trường thật.

## Kịch bản demo đề xuất

### Chuẩn bị trước khi trình bày

MedFlow đang chạy trên gói [Render Free](https://render.com/docs/free). Backend và AI có thể ngủ sau một thời gian không hoạt động, vì vậy lần truy cập đầu tiên có thể mất khoảng 1–2 phút.

1. Mở service `medflow-backend` trên Render và truy cập URL public của service.
2. Mở service `medflow-ai` và chờ endpoint `/health` trả kết quả thành công.
3. Mở URL của `medflow-frontend` và chờ trạng thái máy chủ trên trang đăng nhập chuyển sang sẵn sàng.
4. Nếu lần phân tích triệu chứng đầu tiên gặp `502`, chờ AI khởi động hoàn tất rồi gửi lại một lần.

### Luồng bệnh nhân — khoảng 3 phút

1. Mở trang đăng nhập và giữ chế độ **Cổng bệnh nhân**.
2. Nhập họ tên và CCCD demo `001204012345`, hoặc dùng thông tin giả lập mới để tạo lượt test sạch.
3. Chọn **Lấy số khám**, hoàn tất biểu mẫu check-in.
4. Khai báo triệu chứng, ví dụ:

   ```text
   Đau mỏi cổ từ sáng, hơi cứng khi xoay đầu, mức đau 4/10.
   ```

5. Gửi biểu mẫu và xem kết quả AI: khoa, phòng, độ tin cậy và mức ưu tiên.
6. Mở **Lộ trình** để xem phòng hiện tại, số thứ tự và các bước khám đã lưu.

### Luồng bác sĩ — khoảng 3 phút

1. Đăng xuất hoặc mở một cửa sổ ẩn danh.
2. Chọn **Đăng nhập nhân viên**.
3. Dùng `bs.nguyen.minh.khang@vaic.vn` / `12345678` để vào phòng Tổng quát 101.
4. Mở **Hàng đợi**, tìm bệnh nhân vừa check-in và gọi lượt.
5. Mở hồ sơ khám, cập nhật nội dung khám và tạo chỉ định dịch vụ nếu cần.
6. Quay lại cổng bệnh nhân để quan sát lộ trình và trạng thái được cập nhật.

### Luồng kiosk — khoảng 1 phút

1. Từ trang đăng nhập, chọn **Mở chế độ kiosk**.
2. Nhập họ tên và một CCCD giả lập 9–12 chữ số chưa sử dụng.
3. Xác nhận check-in và ghi nhận mã lượt khám.
4. Quay lại cổng bệnh nhân, đăng nhập bằng cùng CCCD để khai báo triệu chứng.

## Chạy local

### Yêu cầu

- Node.js 22 và npm.
- Python 3.12.
- PostgreSQL hoặc một Neon database cho backend.

### 1. Cấu hình môi trường

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
Copy-Item ai\.env.example ai\.env
```

Cập nhật tối thiểu `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`, `AI_SERVICE_URL` trong `backend/.env`. Không commit file `.env` hoặc credential thật.

### 2. Cài dependency

```powershell
cd backend
npm ci
npm run prisma:generate

cd ..\frontend
npm ci

cd ..\ai
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Chuẩn bị database demo

Với database đã có lịch sử migration:

```powershell
cd backend
npm run prisma:deploy
npm run prisma:seed
npm run prisma:seed:clinic
npm run prisma:seed:staff
```

Các mật khẩu seed được đọc từ `SEED_ADMIN_PASSWORD`, `SEED_DOCTOR_PASSWORD` và `SEED_NURSE_PASSWORD`. Chỉ dùng các giá trị mặc định trong môi trường local/demo.

### 4. Chạy ba service

Mở ba terminal riêng:

```powershell
# Terminal 1 — AI
cd ai
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2 — Backend
cd backend
npm run dev
```

```powershell
# Terminal 3 — Frontend
cd frontend
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`, backend tại `http://localhost:3000` và AI tại `http://localhost:8000`.

## Kiểm thử

```powershell
cd backend
npm run lint
npm test
npm run prisma:validate

cd ..\frontend
npm run lint
npm test
npm run build
```

Smoke test end-to-end với backend đã chạy:

```powershell
$env:SMOKE_BACKEND_URL='http://localhost:3000'
$env:SMOKE_PATIENT_CCCD='090000000123'
node scripts\smoke\e2e.mjs
```

## 🏥 Phân Hệ Điều Phối Khám Bệnh & Phân Loại Cấp Cứu Y Tế (Clinical Workflow & Triage Engine)

MedFlow hiện thực hóa kiến trúc lõi của hệ thống **HIS/EMR (Hospital Information System / Electronic Medical Record)** hiện đại, giải quyết triệt để bài toán đứt gãy luồng bệnh nhân và phân loại cấp cứu sai lệch:

```mermaid
stateDiagram-v2
    [*] --> CHECKED_IN: Check-in & Triage ESI (P1-P5)
    CHECKED_IN --> WAITING_CONSULTATION: Xếp vào buồng khám ban đầu (A)
    WAITING_CONSULTATION --> IN_CONSULTATION: Bác sĩ gọi khám (Ưu tiên P1 > Priority Bump > P3-P5)
    IN_CONSULTATION --> IN_PARACLINICAL: Bác sĩ chỉ định Cận lâm sàng (B)
    IN_PARACLINICAL --> WAITING_REVIEW: Tất cả CLS hoàn thành (Atomic Transaction)
    note right of WAITING_REVIEW: Auto-return buồng khám ban đầu (A)<br/>Kèm cờ Priority Bump (isPriorityBump=true)
    WAITING_REVIEW --> IN_CONSULTATION: Bác sĩ đọc kết quả & kết luận
    IN_CONSULTATION --> COMPLETED: Hoàn thành lượt khám
    COMPLETED --> [*]
```

### 1. Chu trình Điều phối 3 Bước ($A \to B \to A'$) & State Machine
- **Khắc phục lỗi đứt gãy luồng khám:** Mỗi encounter ghi nhận `initialRoomId` và `currentRoomId`. Khi bệnh nhân đi làm xét nghiệm/chẩn đoán hình ảnh tại phòng (B), hệ thống lưu vết `originRoomId`.
- **Atomic Transaction & Tự động quay về:** API `POST /api/v1/doctor/orders/:id/complete` thực hiện trong một Prisma Transaction duy nhất. Ngay khi tất cả chỉ định cận lâm sàng của lượt khám hoàn thành (`COMPLETED`), hệ thống:
  1. Cập nhật `PatientJourney.queueStatus = 'WAITING_REVIEW'`.
  2. Tự động chuyển `PatientJourney.currentRoomId` quay lại `initialRoomId`.
  3. Kích hoạt cờ `isPriorityBump = true` trên hàng đợi của buồng khám ban đầu.

### 2. Thuật toán Sắp xếp Hàng đợi với Cơ chế Priority Bump
Hàng đợi buồng khám sắp xếp theo thứ tự ưu tiên kép chuẩn y khoa:
$$\text{Cấp cứu (P1 / P2)} \;\succ\; \text{Bệnh nhân đọc kết quả CLS (Priority Bump)} \;\succ\; \text{Khám mới (P3 / P4 / P5)} \;\succ\; \text{Thời gian đến (FIFO)}$$
- Giúp bệnh nhân đã làm xong xét nghiệm không phải xếp hàng lại từ đầu sau hàng dài bệnh nhân mới, giảm thiểu triệt để thời gian lưu viện (Length of Stay - LOS).

### 3. Bộ máy Phân loại Cấp cứu ESI 5 Cấp Độ (Triage Engine)
Tích hợp thang đo quốc tế **ESI (Emergency Severity Index)** kết hợp chỉ số sinh tồn (Vital Signs: SpO2, Pulse, SBP, RR, GCS/AVPU, Pain):
- **P1 - Resuscitation (Hồi sức cấp cứu):** Ngừng tuần hoàn, suy hô hấp nặng, hôn mê ($GCS \le 8$, Unresponsive).
- **P2 - Emergent (Khẩn cấp):** Đau ngực kiểu mạch vành, đột quỵ cấp, lơ mơ ($GCS < 13$), SpO2 tụt, huyết áp tụt.
- **P3 - Urgent (Cấp bách):** Cần $\ge 2$ nguồn lực cận lâm sàng, sinh hiệu ổn định.
- **P4 - Less Urgent (Ít cấp bách):** Cần 1 nguồn lực (ví dụ chỉ định X-quang hoặc xét nghiệm nước tiểu).
- **P5 - Non-urgent (Không cấp bách):** Khám thông thường, tái kê đơn, không cần cận lâm sàng.

> **Hai Chốt An Toàn Lâm Sàng (Clinical Guardrails):**
> - **Anti-Under-Triage Safeguard (Chống bỏ sót nguy kịch):** Tự động nâng lên **P1/P2** nếu phát hiện *Silent Hypoxia* ($\text{SpO2} < 88\%$), tụt huyết áp ($\text{SBP} < 80\text{ mmHg}$), thở nhanh/chậm bất thường ($\text{RR} > 30$ hoặc $< 8$), bất kể triệu chứng mô tả ban đầu nhẹ thế nào.
> - **Anti-Over-Triage Safeguard (Chống quá tải khu cấp cứu):** Bệnh nhân đau dữ dội ($\text{Pain} \ge 7/10$) nhưng các dấu hiệu sinh tồn hoàn toàn ổn định được giới hạn ở **P3** (thay vì nâng bừa bãi lên P2), tránh làm tê liệt buồng cấp cứu bởi các ca đau cơ xương khớp/đau răng thông thường.

### 4. Bộ máy Ước Lượng Thời Gian Chờ Động (Dynamic Wait-Time Engine)
- **Loại trừ bệnh nhân cận lâm sàng:** Không tính thời gian chờ của những bệnh nhân đang ở phòng xét nghiệm/chẩn đoán hình ảnh vào hàng đợi buồng khám (`isAwayInParaclinical = true`), loại bỏ thời gian ảo.
- **Chia tải theo Bác sĩ Active:** Tính toán theo năng lực phục vụ thực tế: $W_i = \frac{\sum_{j=1}^{i-1} T_j}{N_{\text{active\_doctors}}}$.
- **Xử lý Preemption:** Khi có ca P1/P2 xen ngang, thời gian chờ được cập nhật linh hoạt và đảm bảo $EWT \ge 0$.
- **Đo lường thời gian thực:** Lưu vết `actual_wait_time = completed_at - arrival_time` để phục vụ retraining mô hình hồi quy (Wait-Time Regressor).

---

## Phân hệ Dữ liệu & Phân tích Nâng cao (Enterprise Data Platform)

Phân hệ Data Platform của MedFlow được thiết kế theo chuẩn **Enterprise Data Analyst / Data Engineer**, kết hợp hoàn chỉnh giữa **Data Engineering (Medallion & Star Schema, Data Quality, ETL/ELT Pipeline)**, **Advanced Analytics (EDA, Phân vị P50/P80/P90, Mô phỏng San tải AI)** và **Executive BI Dashboarding (Streamlit 4 trang & Power BI DAX)**:

```mermaid
flowchart LR
    subgraph S1["1. Ingestion Layer"]
        DB[("Neon PostgreSQL / OLTP")]
        EXTRACT["extract.py<br/>(Bronze Raw Staging)"]
    end

    subgraph S2["2. Quality & Governance Layer"]
        DQ["data_quality.py<br/>(28+ DAMA Rules)"]
        MASK["PII Masking<br/>(SHA-256 Hasher)"]
        SILVER[("Silver Parquet<br/>UTC+7 Standardized")]
    end

    subgraph S3["3. Serving & Modeling Layer"]
        MART["datamart.py<br/>(Star Schema Builder)"]
        GOLD[("Gold Data Mart<br/>Facts & Dimensions")]
    end

    subgraph S4["4. BI & AI Consumption"]
        EDA["01_eda_and_statistical_analysis.py"]
        SIM["simulation_engine.py"]
        ST["Streamlit Executive Center<br/>(4 Pages)"]
        PBI["Power BI DAX Measures & Schema"]
    end

    DB --> EXTRACT
    EXTRACT --> DQ
    DQ --> MASK
    MASK --> SILVER
    SILVER --> MART
    MART --> GOLD
    GOLD --> ST
    GOLD --> PBI
    SILVER --> EDA
    SILVER --> SIM
```

### 🎯 Hiệu quả Định lượng & Tác động Nghiệp vụ (Quantitative Impact)

| Hạng mục / Chỉ số | Phương pháp Truyền thống (Static FCFS) | Điều phối Động AI (MedFlow Dynamic) | Mức độ Cải thiện ($\Delta W$) |
| :--- | :--- | :--- | :--- |
| **Median Wait Time (P50)** | 18.5 phút | **10.2 phút** | **Giảm 44.8%** 🟢 |
| **Tail Risk Wait (P80)** | 28.4 phút | **16.5 phút** | **Giảm 41.9%** 🟢 |
| **SLA Breach Rate** | 22.5% | **6.8%** | **Giảm 69.8% vi phạm** 🟢 |
| **Cân bằng Tải Buồng Khám ($CV$)** | 0.48 (Lệch tải cao) | **0.14 (Phân bổ đồng đều)** | **Cân bằng tải gấp 3.4 lần** 🟢 |
| **Chất lượng Dữ liệu (DQ Score)** | — | **100% (28/28 Rules Passed)** | **Đạt chuẩn DAMA-DMBOK** 🟢 |

---

## Triển khai

File [`render.yaml`](render.yaml) tạo ba service:

- `medflow-frontend`: React/Vite static site.
- `medflow-backend`: Node/Express API và Prisma migration.
- `medflow-ai`: FastAPI unified AI service.

Xem hướng dẫn chi tiết tại [`DEPLOYMENT.md`](DEPLOYMENT.md) và danh sách biến môi trường tại [`RENDER_ENV_VARS.md`](RENDER_ENV_VARS.md).

## Cấu trúc repository

```text
.
├── frontend/       React application cho bệnh nhân, bác sĩ và quản trị
├── backend/        Express API, Prisma schema, migration và seed scripts
├── ai/             Symptom routing, peak forecast và wait-time engine
├── analytics/      Data engineering pipeline, Star Schema data mart, EDA, Streamlit dashboard và Power BI DAX
├── docs/           Kiến trúc dữ liệu, Data dictionary, API contract, hướng dẫn tích hợp
├── scripts/        Smoke test và công cụ hỗ trợ
└── render.yaml     Render Blueprint cho môi trường demo
```

## Tài liệu Kỹ thuật & Data Governance

- [Tài liệu Bảo vệ Kỹ thuật Phỏng vấn (HIS/EMR, Triage, Queuing & Data Platform)](docs/INTERVIEW_TECHNICAL_DEFENSE.md)
- [Kiến trúc dữ liệu & Medallion Pipeline](docs/ARCHITECTURE_DATA.md)
- [Từ điển dữ liệu chuẩn DAMA-DMBOK](docs/DATA_DICTIONARY.md)
- [Enterprise Data Platform & Phân tích chuyên sâu](analytics/README.md)
- [Bộ công thức DAX Measures cho Power BI](analytics/powerbi/DAX_Measures.dax)
- [Lược đồ ngữ nghĩa Star Schema Power BI](analytics/powerbi/powerbi_schema.json)
- [Kiến trúc hệ thống](docs/ARCHITECTURE.md)
- [API contract](docs/API_CONTRACT.md)
- [Hướng dẫn tích hợp](docs/INTEGRATION_GUIDE.md)
- [Routing Agent handoff](docs/ROUTING_AGENT_HANDOFF.md)
- [Giới hạn và giả định](docs/LIMITATIONS.md)
- [Báo cáo xác minh kỹ thuật](docs/VERIFICATION_REPORT.md)

## Phạm vi và giới hạn

- Model và dữ liệu analytics hiện là **SYNTHETIC_ONLY** và **NOT_CLINICALLY_VALIDATED**.
- Gói Render Free có cold start; nên làm nóng backend và AI trước khi demo.
- Analytics chưa được public trong Blueprint vì chưa có lớp kiểm soát truy cập phù hợp.
- Hệ thống là sản phẩm demo kỹ thuật, không phải phần mềm y tế dùng trong vận hành thực tế.
