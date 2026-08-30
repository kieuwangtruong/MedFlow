# MEDFLOW — DATA ANALYST CV & PORTFOLIO SHOWCASE (VNPT / VAIC ALIGNED)

Tài liệu này chứa nội dung chuẩn hóa theo **Checklist kỹ thuật 6 bước [MF-01 → MF-06]** cho vị trí **Data Analyst (Fresher/Junior)** tại VNPT và các doanh nghiệp công nghệ số.

---

## 📌 1. BẢN TIẾNG VIỆT (TỐI ƯU CHO VNPT & DOANH NGHIỆP TRONG NƯỚC)

### **DỰ ÁN NỔI BẬT**

**MEDFLOW – Nền Tảng Phân Tích Dữ Liệu & Tối Ưu Hóa Vận Hành Hàng Đợi Bệnh Viện** *(Bài toán Y tế số / VNPT VAIC)*  
*Vai trò: Data Analyst (Fresher/Junior)* &nbsp;|&nbsp; *10/2025 – Hiện tại*  
* **Live Web App:** [https://medflow-frontend-y3e6.onrender.com/login](https://medflow-frontend-y3e6.onrender.com/login)  
* **Streamlit BI Dashboard:** [https://medflow-analytics.streamlit.app](https://medflow-analytics.streamlit.app)  
* **GitHub Repository:** [https://github.com/kieuwangtruong/MedFlow](https://github.com/kieuwangtruong/MedFlow)  
* **Công nghệ sử dụng:** Python (Pandas, NumPy, SciPy, Streamlit, Plotly), PostgreSQL/Neon, Star Schema (Data Mart), Git.

**Kỹ thuật cốt lõi & Đóng góp:**
* **Data Modeling & Dictionary [MF-01]:** Khảo sát nghiệp vụ tiếp đón y tế số (Case study VNPT/VAIC), chuẩn hóa từ điển dữ liệu (Data Dictionary) và thiết kế Data Mart Star Schema (`fact_patient_journey`, `dim_departments`) quản lý hơn **10.000+ lượt khám** tại 12 chuyên khoa lâm sàng.
* **ETL & Data Cleaning Pipeline [MF-02]:** Xây dựng pipeline Python (Pandas) tự động xử lý missing values, loại bỏ bản ghi ngoại lai (thời gian chờ âm, service duration $>180$ phút) và chuẩn hóa đồng bộ múi giờ từ ISO UTC sang `Asia/Ho_Chi_Minh`.
* **Phân Tích Thống Kê & Điểm Nghẽn Luồng Khám [MF-03]:** Ứng dụng SciPy/SQL tính toán các phân vị $P_{50}, P_{80}, P_{90}$ thay thế giá trị trung bình (Mean) bị lệch phải; cô lập và chỉ ra điểm nghẽn nghiêm trọng nhất tại khâu cận lâm sàng/CĐHA với thời gian chờ $P_{80}$ kéo dài **48 phút** trong luồng khép kín 3 bước ($A \to B \to A'$: Khám ban đầu $\to$ CLS $\to$ Tái khám).
* **Mô Phỏng San Tải & Dashboard Điều Hành [MF-04, MF-05]:** Lập trình thuật toán mô phỏng hàng đợi ngẫu nhiên rời rạc (Discrete-Event Simulation) chứng minh giải pháp *AI Dynamic Routing* giúp **giảm 18% – 25% thời gian chờ trung vị ($P_{50}$)** trong khung giờ cao điểm; triển khai Streamlit Dashboard trực quan hóa Heatmap mật độ buồng khám và ma trận cảnh báo vi phạm cam kết SLA y tế theo thời gian thực.

---

## 📌 2. BẢN TIẾNG ANH (ATS-FRIENDLY & US TECH COMPLIANT)

### **PROJECTS**

**MEDFLOW – Hospital Queue Intelligence & Operational Analytics Platform** *(Digital Healthcare / VAIC Case Study)*  
*Role: Junior Data Analyst* &nbsp;|&nbsp; *Oct 2025 – Present*  
* **Live Frontend App:** [https://medflow-frontend-y3e6.onrender.com/login](https://medflow-frontend-y3e6.onrender.com/login)  
* **Live Streamlit Dashboard:** [https://medflow-analytics.streamlit.app](https://medflow-analytics.streamlit.app)  
* **GitHub Repo:** [https://github.com/kieuwangtruong/MedFlow](https://github.com/kieuwangtruong/MedFlow)  
* **Tech Stack:** Python (Pandas, NumPy, SciPy, Streamlit, Plotly), PostgreSQL/Neon, Star Schema (Data Mart), Git.

**Key Achievements & Impact:**
* **Data Understanding & Data Mart Design [MF-01]:** Formulated an end-to-end Data Dictionary and designed a Star Schema Data Mart (`fact_patient_journey`, `dim_departments`) based on digital outpatient workflows (VNPT/VAIC case study), organizing **10,000+ patient records** across 12 clinical departments.
* **ETL & Data Preprocessing Pipeline [MF-02]:** Engineered an automated Python (Pandas) data cleansing pipeline handling missing values, filtering physiological/log anomalies (negative durations, tasks $>180$ mins), and converting UTC timestamps to local timezone (`Asia/Ho_Chi_Minh`).
* **Descriptive & Percentile Bottleneck Analytics [MF-03]:** Computed robust statistical percentiles ($P_{50}, P_{80}, P_{90}$ via SciPy/SQL) to overcome right-skewed mean bias; isolated a critical diagnostic turnaround bottleneck of **48 minutes ($P_{80}$ wait)** within the closed-loop 3-step pathway ($A \to B \to A'$: Consult $\to$ Lab/Imaging $\to$ Review).
* **Discrete-Event Simulation & Operational Dashboard [MF-04, MF-05]:** Programmed a discrete-event simulation engine benchmarking routing strategies, quantifying an **18% – 25% reduction in median wait time ($P_{50}$)** during peak arrival surges using *AI Dynamic Routing*; deployed a multi-page interactive Streamlit Control Center visualizing real-time room load heatmaps and clinical SLA breach matrices.

---

## 📌 3. BÀI ĐĂNG LINKEDIN / PORTFOLIO CASE STUDY (MẪU SẴN)

```text
🚀 [Portfolio Showcase] MedFlow – Hospital Queue Intelligence & Operational Analytics Platform (VNPT VAIC Case Study)

🏥 The Operational Challenge:
In multi-specialty outpatient clinics, patient wait times exhibit severe right-skewed distributions due to emergency cases and 3-step diagnostic loops (A -> B -> A'). Simple averages fail to locate the true operational bottlenecks.

💡 Technical Approach & Delivery:
1. [MF-01 & MF-02] Cleaned 10,000+ patient encounter logs in Pandas, engineered Star Schema Data Mart (fact_patient_journey, dim_departments), and normalized timezone to Asia/Ho_Chi_Minh.
2. [MF-03] Modeled statistical percentiles (P50/P80/P90) via SciPy, isolating a 48-minute P80 wait bottleneck in Diagnostic Imaging.
3. [MF-04 & MF-05] Built Discrete-Event Simulation proving an 18% - 25% median wait reduction with AI Dynamic Routing, visualized on an interactive Streamlit Control Center.

🔗 Live Web App: https://medflow-frontend-y3e6.onrender.com/login
📊 Live Streamlit Dashboard: https://medflow-analytics.streamlit.app
💻 GitHub Repo: https://github.com/kieuwangtruong/MedFlow

#DataAnalytics #VNPT #VAIC #Python #Pandas #Streamlit #StarSchema #HealthcareAnalytics #SciPy
```
