from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from analytics.dashboard.common import PALETTE, load_dashboard_data

st.set_page_config(
    page_title="MedFlow Executive Command Center",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

# De-AI Enterprise Clean CSS Styling (No generic neon/AI template look)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    html, body, [class*="css"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .main-header {
        padding-bottom: 8px;
        margin-bottom: 16px;
        border-bottom: 1px solid #E2E8F0;
    }
    .kpi-container {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        margin-bottom: 12px;
    }
    .kpi-title {
        font-size: 13px;
        font-weight: 600;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .kpi-value {
        font-size: 30px;
        font-weight: 800;
        color: #0F172A;
        margin: 4px 0;
    }
    .kpi-sub {
        font-size: 12px;
        font-weight: 500;
    }
    .sub-good { color: #059669; }
    .sub-warn { color: #D97706; }
    .sub-bad { color: #DC2626; }
    
    .nav-card {
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        border-radius: 10px;
        padding: 16px;
        transition: all 0.2s ease-in-out;
    }
    .nav-card:hover {
        border-color: #0284C7;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.08);
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# SIDEBAR FILTERS & DATA SOURCE
# -------------------------------------------------------------
st.sidebar.markdown("### ⚙️ Cấu Hình Dữ Liệu")
prefer_live = st.sidebar.toggle("Ưu tiên PostgreSQL Live", value=True)

try:
    tasks, journeys, source = load_dashboard_data(prefer_live)
except Exception as error:  # noqa: BLE001
    st.error(f"Không thể nạp dữ liệu từ nguồn: {error}")
    st.stop()

st.sidebar.markdown("---")
st.sidebar.markdown("### 🔍 Bộ Lọc Vận Hành")

filtered_tasks = tasks.copy()

# Date Filter if available
if "event_date" in filtered_tasks and filtered_tasks["event_date"].notna().any():
    min_date = filtered_tasks["event_date"].dropna().min()
    max_date = filtered_tasks["event_date"].dropna().max()
    selected_dates = st.sidebar.date_input("Khoảng ngày ghi nhận", value=(min_date, max_date))
    if isinstance(selected_dates, (tuple, list)) and len(selected_dates) == 2:
        filtered_tasks = filtered_tasks[filtered_tasks["event_date"].between(selected_dates[0], selected_dates[1])]

# Priority Filter
if "clinical_priority" in filtered_tasks and filtered_tasks["clinical_priority"].notna().any():
    priorities = sorted(filtered_tasks["clinical_priority"].dropna().unique())
    selected_p = st.sidebar.multiselect("Phân loại cấp cứu / Ưu tiên", priorities, default=[])
    if selected_p:
        filtered_tasks = filtered_tasks[filtered_tasks["clinical_priority"].isin(selected_p)]

# Department / Room Filter
if "room_name" in filtered_tasks and filtered_tasks["room_name"].notna().any():
    rooms = sorted(filtered_tasks["room_name"].dropna().unique())
    selected_rooms = st.sidebar.multiselect("Phòng khám / Bộ phận", rooms, default=[])
    if selected_rooms:
        filtered_tasks = filtered_tasks[filtered_tasks["room_name"].isin(selected_rooms)]

# -------------------------------------------------------------
# HEADER & SOURCE BADGE
# -------------------------------------------------------------
st.markdown("""
<div class="main-header">
    <h1 style="color: #0F172A; font-size: 28px; font-weight: 800; margin: 0;">🏥 MedFlow Executive Operations Command Center</h1>
    <p style="color: #475569; font-size: 15px; margin: 4px 0 0 0;">Hệ Thống Giám Sát, Chẩn Đoán Điểm Nghẽn & Tối Ưu Hóa Hàng Đợi Bệnh Viện (O-I-A Decision Framework)</p>
</div>
""", unsafe_allow_html=True)

badge_type = "🟢 LIVE DATABASE" if source.startswith("PostgreSQL") else "🔵 SYNTHETIC SEEDED DEMO"
c_badge1, c_badge2 = st.columns([3, 1])
with c_badge1:
    st.caption(f"**Nguồn dữ liệu:** `{source}` &nbsp;|&nbsp; **Trạng thái:** {badge_type} &nbsp;|&nbsp; **Auto-Refresh:** Mỗi 5 phút.")
with c_badge2:
    st.caption(f"**Tổng mẫu phân tích:** `{len(filtered_tasks):,}` task | `{filtered_tasks['journey_id'].nunique():,}` ca khám")

# -------------------------------------------------------------
# SECTION 1: TOP 4 METRICS (O-I-A EXECUTIVE SCORECARD)
# -------------------------------------------------------------
st.markdown("### 1. Tầng Điều Hành Cốt Lõi (Top Executive KPIs)")

valid_wait = filtered_tasks["operational_wait_minutes"].dropna()
mean_wait = valid_wait.mean() if not valid_wait.empty else 0.0
p90_wait = np.percentile(valid_wait, 90) if not valid_wait.empty else 0.0

sla_breach_rate = (filtered_tasks["sla_breach"].mean() * 100) if "sla_breach" in filtered_tasks and len(filtered_tasks) else 0.0
completed_rate = (filtered_tasks["status"].eq("COMPLETED").mean() * 100) if "status" in filtered_tasks and len(filtered_tasks) else 0.0

active_rooms_count = filtered_tasks["room_name"].nunique() if "room_name" in filtered_tasks else 0
busy_rooms_ratio = min(100.0, (len(filtered_tasks[filtered_tasks["status"].isin(["IN_PROGRESS", "CALLED", "WAITING_EXAM"])]) / max(1, active_rooms_count * 5)) * 100)

kpi1, kpi2, kpi3, kpi4 = st.columns(4)

with kpi1:
    # AWT - Average Wait Time
    delta_awt = mean_wait - 25.0
    status_class = "sub-good" if mean_wait <= 25 else ("sub-warn" if mean_wait <= 40 else "sub-bad")
    status_text = "🟢 Đạt chuẩn SLA viện" if mean_wait <= 25 else ("🟡 Ngưỡng cảnh báo" if mean_wait <= 40 else "🔴 Vượt ngưỡng cho phép")
    st.markdown(f"""
    <div class="kpi-container">
        <div class="kpi-title">Thời Gian Chờ TB (AWT)</div>
        <div class="kpi-value">{mean_wait:.1f} <span style="font-size: 16px; font-weight: 500; color: #64748B;">phút</span></div>
        <div class="kpi-sub {status_class}">{status_text} (Chuẩn: 25.0p | P90: {p90_wait:.1f}p)</div>
    </div>
    """, unsafe_allow_html=True)

with kpi2:
    # SLA Breach Rate
    sla_class = "sub-good" if sla_breach_rate <= 5.0 else ("sub-warn" if sla_breach_rate <= 12.0 else "sub-bad")
    sla_text = "🟢 An toàn (< 5%)" if sla_breach_rate <= 5.0 else ("🟡 Cần theo dõi ca trễ" if sla_breach_rate <= 12.0 else "🔴 Nguy cơ bệnh nhân bỏ về")
    st.markdown(f"""
    <div class="kpi-container">
        <div class="kpi-title">Tỷ Lệ Vi Phạm SLA Chờ</div>
        <div class="kpi-value">{sla_breach_rate:.1f}%</div>
        <div class="kpi-sub {sla_class}">{sla_text} (Ngưỡng cảnh báo: 10.0%)</div>
    </div>
    """, unsafe_allow_html=True)

with kpi3:
    # Room Capacity Utilization
    cur_class = "sub-good" if 60 <= busy_rooms_ratio <= 85 else ("sub-warn" if busy_rooms_ratio < 60 else "sub-bad")
    cur_text = "🟢 Tối ưu công suất (60-85%)" if 60 <= busy_rooms_ratio <= 85 else ("🟡 Dưới tải phòng khám" if busy_rooms_ratio < 60 else "🔴 Quá tải bàn khám")
    st.markdown(f"""
    <div class="kpi-container">
        <div class="kpi-title">Áp Lực Phòng Khám (Load)</div>
        <div class="kpi-value">{busy_rooms_ratio:.1f}%</div>
        <div class="kpi-sub {cur_class}">{cur_text} ({active_rooms_count} phòng đang mở)</div>
    </div>
    """, unsafe_allow_html=True)

with kpi4:
    # Completion Rate
    comp_class = "sub-good" if completed_rate >= 75 else ("sub-warn" if completed_rate >= 50 else "sub-bad")
    comp_text = "🟢 Luồng thông suốt" if completed_rate >= 75 else "🟡 Đang tồn đọng khâu chờ CLS"
    st.markdown(f"""
    <div class="kpi-container">
        <div class="kpi-title">Tỷ Lệ Hoàn Tất Quy Trình</div>
        <div class="kpi-value">{completed_rate:.1f}%</div>
        <div class="kpi-sub {comp_class}">{comp_text} ({filtered_tasks['journey_id'].nunique():,} lượt bệnh nhân)</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

# -------------------------------------------------------------
# SECTION 2: DIAGNOSTIC & BOTTLENECK CHARTS
# -------------------------------------------------------------
st.markdown("### 2. Chẩn Đoán Điểm Nghẽn Vận Hành (Diagnostic Pulse)")

col_diag_left, col_diag_right = st.columns([1, 1])

with col_diag_left:
    st.markdown("##### 📍 Top 5 Điểm Nghẽn: Phòng Khám Có Hàng Đợi & Chờ Lâu Nhất")
    if "room_name" in filtered_tasks and "operational_wait_minutes" in filtered_tasks:
        room_agg = (
            filtered_tasks.groupby("room_name")
            .agg(
                avg_wait=("operational_wait_minutes", "mean"),
                task_count=("task_id", "count"),
                sla_breaches=("sla_breach", "sum"),
            )
            .reset_index()
            .sort_values(by="avg_wait", ascending=False)
            .head(5)
        )
        
        # Color coding bars based on wait threshold
        colors = ["#DC2626" if w > 35 else ("#D97706" if w > 25 else "#0284C7") for w in room_agg["avg_wait"]]
        
        fig_rooms = go.Figure(
            go.Bar(
                x=room_agg["avg_wait"],
                y=room_agg["room_name"],
                orientation="h",
                marker=dict(color=colors, line=dict(color="#0F172A", width=0.5)),
                text=[f"{w:.1f}p ({int(b)} ca trễ)" for w, b in zip(room_agg["avg_wait"], room_agg["sla_breaches"])],
                textposition="outside",
            )
        )
        fig_rooms.update_layout(
            height=280,
            margin=dict(l=10, r=40, t=20, b=20),
            xaxis=dict(title="Thời gian chờ TB (Phút)", gridcolor="#F1F5F9"),
            yaxis=dict(autorange="reversed"),
            plot_bgcolor="white",
            paper_bgcolor="white",
        )
        st.plotly_chart(fig_rooms, use_container_width=True)
    else:
        st.info("Chưa đủ dữ liệu phòng để vẽ biểu đồ điểm nghẽn.")

with col_diag_right:
    st.markdown("##### ⏱️ Nhịp Tiếp Nhận & Thời Gian Chờ Theo Khung Giờ")
    if "event_hour" in filtered_tasks and filtered_tasks["event_hour"].notna().any():
        hourly = (
            filtered_tasks.groupby("event_hour")
            .agg(
                patient_volume=("task_id", "count"),
                mean_wait=("operational_wait_minutes", "mean"),
            )
            .reset_index()
            .sort_values(by="event_hour")
        )
        
        fig_hourly = go.Figure()
        # Bar: Volume
        fig_hourly.add_trace(
            go.Bar(
                x=hourly["event_hour"],
                y=hourly["patient_volume"],
                name="Số ca tiếp nhận",
                marker_color="#94A3B8",
                opacity=0.6,
                yaxis="y",
            )
        )
        # Line: Wait time
        fig_hourly.add_trace(
            go.Scatter(
                x=hourly["event_hour"],
                y=hourly["mean_wait"],
                name="Thời gian chờ TB (phút)",
                mode="lines+markers",
                line=dict(color="#DC2626", width=2.5),
                marker=dict(size=6),
                yaxis="y2",
            )
        )
        fig_hourly.update_layout(
            height=280,
            margin=dict(l=10, r=10, t=20, b=20),
            xaxis=dict(title="Khung giờ trong ngày (Giờ)", dtick=1),
            yaxis=dict(title="Lượt khám", showgrid=False),
            yaxis2=dict(title="Chờ (phút)", overlaying="y", side="right", showgrid=True, gridcolor="#F1F5F9"),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            plot_bgcolor="white",
            paper_bgcolor="white",
        )
        st.plotly_chart(fig_hourly, use_container_width=True)
    else:
        st.info("Chưa có trường thời gian theo giờ để tổng hợp.")

# -------------------------------------------------------------
# SECTION 3: AI EARLY OVERLOAD WARNING & QUEUE ADVICE
# -------------------------------------------------------------
st.markdown("### 3. Tầng Cảnh Báo Sớm AI & Đề Xuất Điều Phối (AI Prescriptive Alerts)")

critical_tasks = filtered_tasks[filtered_tasks["sla_breach"] | (filtered_tasks["operational_wait_minutes"] > 35)]
if not critical_tasks.empty:
    st.warning(
        f"⚠️ **Hệ Thống AI Phát Hiện Điểm Nóng:** Hiện có **{len(critical_tasks)} lượt khám** có thời gian chờ vượt ngưỡng SLA chuẩn. "
        "Nguyên nhân chính: Sự dồn ứ bệnh nhân sau khi có chỉ định Cận lâm sàng và thời gian quay lại phòng khám ban đầu (`WAITING_REVIEW`)."
    )
else:
    st.success("✅ **Hệ Thống Ổn Định:** Toàn bộ các phòng khám và phân hệ cận lâm sàng đang hoạt động trong ngưỡng an toàn.")

# Quick Room Status Table
if "room_name" in filtered_tasks:
    table_summary = (
        filtered_tasks.groupby("room_name")
        .agg(
            Lượt_Khám=("task_id", "count"),
            Chờ_TB_Phút=("operational_wait_minutes", lambda x: f"{x.mean():.1f}"),
            Ca_Vi_Phạm_SLA=("sla_breach", "sum"),
            Trạng_Thái=("operational_wait_minutes", lambda x: "🔴 Nguy cơ quá tải" if x.mean() > 35 else ("🟡 Cần lưu ý" if x.mean() > 25 else "🟢 Thông suốt")),
        )
        .reset_index()
        .sort_values(by="Ca_Vi_Phạm_SLA", ascending=False)
        .head(6)
    )
    st.dataframe(table_summary, use_container_width=True, hide_index=True)

st.markdown("---")

# -------------------------------------------------------------
# SECTION 4: INTERACTIVE NAVIGATION CARDS (O-I-A HUBS)
# -------------------------------------------------------------
st.markdown("### 4. Điều Hướng Đến Các Phân Hệ Phân Tích Chuyên Sâu")
st.markdown("Nhấp vào menu bên trái hoặc xem tóm lược nghiệp vụ của từng phân hệ:")

nav1, nav2, nav3, nav4 = st.columns(4)

with nav1:
    st.markdown("""
    <div class="nav-card">
        <h4 style="margin: 0 0 8px 0; color: #0284C7;">📊 1. Executive Overview</h4>
        <p style="font-size: 13px; color: #475569; margin: 0 0 8px 0;">Bảng điểm toàn viện, ma trận tuân thủ SLA theo từng chuyên khoa và phân vị thời gian chờ (P50, P80, P90).</p>
        <span style="font-size: 12px; font-weight: 700; color: #0284C7;">👉 Dành cho: Ban Giám Đốc</span>
    </div>
    """, unsafe_allow_html=True)

with nav2:
    st.markdown("""
    <div class="nav-card">
        <h4 style="margin: 0 0 8px 0; color: #0284C7;">🏥 2. Room Operations</h4>
        <p style="font-size: 13px; color: #475569; margin: 0 0 8px 0;">Heatmap ma trận tắc nghẽn theo từng phòng khám và khung giờ; tương quan giữa hàng đợi và tốc độ phục vụ.</p>
        <span style="font-size: 12px; font-weight: 700; color: #0284C7;">👉 Dành cho: Trưởng Khoa Lâm Sàng</span>
    </div>
    """, unsafe_allow_html=True)

with nav3:
    st.markdown("""
    <div class="nav-card">
        <h4 style="margin: 0 0 8px 0; color: #0284C7;">🔄 3. Patient Journey</h4>
        <p style="font-size: 13px; color: #475569; margin: 0 0 8px 0;">Truy vết luồng khép kín (A → B → A'), đo lường thời gian trả kết quả Cận lâm sàng và cơ chế ưu tiên kết luận.</p>
        <span style="font-size: 12px; font-weight: 700; color: #0284C7;">👉 Dành cho: Điều Dưỡng Tiếp Đón</span>
    </div>
    """, unsafe_allow_html=True)

with nav4:
    st.markdown("""
    <div class="nav-card">
        <h4 style="margin: 0 0 8px 0; color: #0284C7;">⚡ 4. AI Simulation Sandbox</h4>
        <p style="font-size: 13px; color: #475569; margin: 0 0 8px 0;">Mô phỏng kịch bản What-If: San tải phòng khám, tăng cường bác sĩ và đo lường ROI số phút chờ tiết kiệm được.</p>
        <span style="font-size: 12px; font-weight: 700; color: #0284C7;">👉 Dành cho: Trưởng Ca Điều Phối</span>
    </div>
    """, unsafe_allow_html=True)

st.markdown("""
<div style="margin-top: 30px; padding: 12px 16px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; color: #64748B; text-align: center;">
    MedFlow Decision-Driven Analytics Engine © 2026 · Chuẩn hóa DAMA-DMBOK & HIPAA De-identification Standards.
</div>
""", unsafe_allow_html=True)
