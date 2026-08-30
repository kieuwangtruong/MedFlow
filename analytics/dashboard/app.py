from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from analytics.dashboard.common import PALETTE, load_dashboard_data

st.set_page_config(
    page_title="MedFlow Executive Control Center",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Premium Enterprise CSS Styling
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    .metric-card {
        background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px;
        color: #F8FAFC;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .stMetric {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 12px 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
</style>
""", unsafe_allow_html=True)

st.title("🏥 MedFlow Executive Analytics Control Center")
st.markdown("### Trung Tâm Giám Sát & Tối Ưu Hóa Vận Hành Hàng Đợi Bệnh Viện Đa Khoa")

prefer_live = st.sidebar.toggle("Ưu tiên PostgreSQL Live", value=True)
try:
    tasks, journeys, source = load_dashboard_data(prefer_live)
except Exception as error:
    st.error(f"Không thể nạp dữ liệu: {error}")
    st.stop()

# Top KPI Summary Cards
col1, col2, col3, col4, col5 = st.columns(5)
with col1:
    st.metric("Tổng Số Task", f"{len(tasks):,}")
with col2:
    st.metric("Lượt Khám (Journeys)", f"{tasks['journey_id'].nunique():,}" if 'journey_id' in tasks else "0")
with col3:
    completed_rate = (tasks['status'].eq('COMPLETED').mean() * 100) if 'status' in tasks and len(tasks) else 0.0
    st.metric("Tỷ Lệ Hoàn Tất", f"{completed_rate:.1f}%")
with col4:
    aba_count = int(journeys['has_a_b_return'].sum()) if not journeys.empty else 0
    st.metric("Hành Trình A → B → A'", f"{aba_count:,}")
with col5:
    sla_breach_rate = (tasks['sla_breach'].mean() * 100) if 'sla_breach' in tasks and len(tasks) else 0.0
    st.metric("Vi Phạm SLA", f"{sla_breach_rate:.1f}%", delta=f"{sla_breach_rate:.1f}%", delta_color="inverse")

badge_type = "🟢 LIVE DATABASE" if source.startswith("PostgreSQL") else "🔵 SYNTHETIC SEEDED DEMO"
st.info(f"**Nguồn Dữ Liệu:** {source} &nbsp;|&nbsp; **Trạng Thái:** {badge_type} &nbsp;|&nbsp; **Auto-Refresh:** Mỗi 5 phút.")

st.markdown("""
---
### 🧭 Hướng Dẫn Điều Hướng Phân Hệ Báo Cáo:

1. **📊 1. Executive Overview:**
   - Bảng điểm điều hành toàn viện (Hospital-Wide Executive Scorecard).
   - Xu hướng số lượng bệnh nhân theo ngày và khung giờ.
   - Phân vị thời gian chờ ($P_{50}, P_{80}, P_{90}$) theo 12 chuyên khoa lâm sàng.
   - Ma trận tuân thủ cam kết chất lượng dịch vụ y tế (SLA Compliance Matrix).

2. **🏥 2. Room Operations & Bottlenecks:**
   - Heatmap mật độ bệnh nhân theo phòng khám và từng khung giờ trong ngày.
   - Tương quan giữa số lượng người xếp hàng (Queue Length) và thời gian chờ thực tế.
   - Phân tích tổn thất vận hành do sự cố thiết bị hoặc ca cấp cứu chen ngang.

3. **🔄 3. Patient Journey & Workflow:**
   - Giám sát chi tiết luồng khám khép kín 3 bước ($A \to B \to A'$: Khám ban đầu $\to$ Cận lâm sàng $\to$ Tái khám kết luận).
   - Thời gian chờ trả kết quả cận lâm sàng (Lab/Radiology Turnaround Time).
   - Drill-down bảng chi tiết từng bước khám của từng ca bệnh.

4. **⚡ 4. AI Forecast & Simulation Sandbox:**
   - Dự báo nhu cầu tiếp đón bệnh nhân theo khung 30 phút.
   - Công cụ mô phỏng San tải phòng khám (What-if Scenario Sandbox) so sánh 3 chiến lược: **Static Round-Robin**, **Shortest Queue First (SQF)** và **AI Dynamic Routing**.

---
*MedFlow Enterprise Analytics Engine © 2026. Chuẩn hóa theo DAMA-DMBOK & HIPAA De-identification Standards.*
""")
