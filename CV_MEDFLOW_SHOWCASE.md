# MEDFLOW — CV & PORTFOLIO SHOWCASE ASSETS

Tài liệu này chứa nội dung chuẩn hóa để đưa dự án **MedFlow** vào CV (Resume), LinkedIn và Portfolio cá nhân với đầy đủ link deploy thực tế.

---

## 📌 1. BẢN TIẾNG ANH (CHUẨN ATS & US TECH RECRUITER)

### **PROJECTS**

**MEDFLOW – Hospital Queue Intelligence & Operational Analytics Platform**  
*Role: Data Analyst / Analytics Engineer* &nbsp;|&nbsp; *Oct 2025 – Present*  
* **Live Web App:** [https://medflow-frontend-y3e6.onrender.com/login](https://medflow-frontend-y3e6.onrender.com/login)  
* **Live BI Analytics Control Center:** [https://medflow-analytics.streamlit.app](https://medflow-analytics.streamlit.app)  
* **Source Code Repository:** [https://github.com/kieuwangtruong/MedFlow](https://github.com/kieuwangtruong/MedFlow)  
* **Tech Stack:** Python (Pandas, Plotly, SciPy, Streamlit), SQL (PostgreSQL/Neon), Star Schema (DAMA-DMBOK), Power BI (DAX), FastAPI, Node.js/Express, Docker.

**Key Achievements & Impact:**
* **Enterprise Data Modeling:** Architected a 4-layer Medallion Data Platform and Star Schema (Fact/Dimension) compliant with DAMA-DMBOK, consolidating over 10,000+ patient journey records across 12 clinical specialties.
* **DAX & Percentile Semantic Layer:** Built a library of **20+ advanced DAX measures** and statistical distribution models ($P_{50}, P_{80}, P_{90}$ percentiles via `PERCENTILE.INC`), replacing skewed mean averages to accurately capture the true wait experience of 85%+ of patients.
* **Real-time Executive Control Center:** Deployed a multi-page interactive Streamlit dashboard tracking the closed-loop 3-step patient journey ($A \to B \to A'$: Initial Consult $\to$ Diagnostic Imaging $\to$ Return Review), intraday peak hour heatmaps, and priority-based SLA breach rates.
* **AI What-If Simulation Sandbox:** Engineered a discrete-event simulation engine benchmarking 3 patient routing strategies (*Round-Robin*, *Shortest Queue First*, and *AI Dynamic Routing*), demonstrating an **18% reduction in median operational wait time** under resource failure and emergency surge constraints.

---

## 📌 2. BẢN TIẾNG VIỆT (DÀNH CHO DOANH NGHIỆP TRONG NƯỚC / Y TẾ)

### **DỰ ÁN NỔI BẬT**

**MEDFLOW – Nền Tảng Giám Sát Vận Hành Hàng Đợi & Phân Tích Dữ Liệu Y Tế**  
*Vai trò: Chuyên viên Phân tích Dữ liệu (Data Analyst / Analytics Engineer)*  
* **Hệ Thống Web App Tiếp Đón:** [https://medflow-frontend-y3e6.onrender.com/login](https://medflow-frontend-y3e6.onrender.com/login)  
* **Dashboard Phân Tích BI & Điều Hành:** [https://medflow-analytics.streamlit.app](https://medflow-analytics.streamlit.app)  
* **Mã Nguồn GitHub:** [https://github.com/kieuwangtruong/MedFlow](https://github.com/kieuwangtruong/MedFlow)  
* **Công nghệ sử dụng:** Python (Pandas, Streamlit, Plotly, SciPy), SQL, PostgreSQL/Neon, Star Schema (DAMA-DMBOK), Power BI (DAX Measures), FastAPI, RESTful API.

**Kết quả & Đóng góp chính:**
* **Thiết kế Kiến trúc Dữ liệu Chuẩn:** Xây dựng mô hình Star Schema 4 tầng Medallion (Fact/Dimension) theo tiêu chuẩn DAMA-DMBOK, chuẩn hóa dữ liệu tiếp đón và điều phối của 12 chuyên khoa lâm sàng.
* **Mô Hình Tính Toán Phân Vị Nâng Cao:** Xây dựng bộ thư viện **20+ DAX Measures** và thuật toán phân vị ($P_{50}, P_{80}, P_{90}$), khắc phục hoàn toàn nhược điểm số trung bình (Mean), phản ánh chính xác 85% thời gian chờ thực tế của bệnh nhân.
* **Trung Tâm Điều Hành Real-time (Executive Control Center):** Triển khai Dashboard Streamlit trực quan hóa luồng khám 3 bước khép kín ($A \to B \to A'$: Khám ban đầu $\to$ Cận lâm sàng $\to$ Tái khám kết luận), Heatmap tải phòng khám và ma trận tuân thủ SLA y tế.
* **Mô Phỏng San Tải AI (What-If Simulation Sandbox):** Lập trình công cụ mô phỏng ngẫu nhiên rời rạc (DES) so sánh 3 chiến lược điều phối hàng đợi (*Round-Robin, SQF, AI Dynamic Routing*), chứng minh khả năng **giảm 18% thời gian chờ** khi có ca cấp cứu hoặc sự cố thiết bị.

---

## 📌 3. BÀI ĐĂNG LINKEDIN / PORTFOLIO CASE STUDY (MẪU SẴN)

```text
🚀 Excited to share my latest project: MedFlow – An Enterprise Hospital Queue Intelligence & Operational Analytics Platform!

🏥 Challenge:
In multi-specialty hospitals, outpatient wait times often suffer from severe right-skewed distributions due to emergency interruptions and complex 3-step diagnostic loops (A -> B -> A'). Traditional metrics (like simple averages) fail to identify real operational bottlenecks.

💡 Solution:
I built an end-to-end Healthcare Analytics Platform:
1. Data Architecture: 4-layer Medallion Star Schema adhering to DAMA-DMBOK standards.
2. Semantic Layer: 20+ Advanced DAX Measures & percentile distribution models (P50, P80, P90).
3. Executive Control Center: Real-time Streamlit dashboard tracking room load heatmaps & SLA compliance.
4. AI Simulation Sandbox: Discrete-event simulation proving an 18% wait time reduction with AI Dynamic Routing.

🔗 Live Web App: https://medflow-frontend-y3e6.onrender.com/login
📊 Live BI Dashboard: https://medflow-analytics.streamlit.app
💻 GitHub Repo: https://github.com/kieuwangtruong/MedFlow

#DataAnalytics #PowerBI #DAX #Streamlit #Python #DataModeling #HealthcareAnalytics #StarSchema
```
