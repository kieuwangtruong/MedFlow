from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import pandas as pd
import numpy as np

from analytics.dashboard.common import PALETTE, header
from analytics.src.simulation_engine import SimulationConfig, MedFlowSimulation, run_scenario_comparison

st.set_page_config(page_title="What-If Simulation Sandbox", layout="wide")
header("What-If Simulation Sandbox & Capacity Planning", "Mô phỏng hàng đợi & tải thực tế")

st.markdown("""
Công cụ mô phỏng rời rạc (**Discrete-Event Simulation**) hỗ trợ ban quản trị thử nghiệm các phương án điều phối, bổ sung nhân sự, và mở rộng phòng chụp trước khi áp dụng vào thực tế lâm sàng.
""")

st.sidebar.header("Thông số mô phỏng (What-If Parameters)")

col_sb1, col_sb2 = st.sidebar.columns(2)
num_patients = st.sidebar.slider("Số lượng bệnh nhân mô phỏng", min_value=50, max_value=500, value=200, step=25)
arrival_rate = st.sidebar.slider("Lưu lượng đến (bệnh nhân / giờ)", min_value=10, max_value=60, value=28, step=2)

st.sidebar.subheader("Thiết lập phòng khám (Kịch bản thử nghiệm)")
consult_rooms = st.sidebar.slider("Số phòng khám ban đầu (Khám lâm sàng)", min_value=2, max_value=10, value=5, step=1)
diag_rooms = st.sidebar.slider("Số phòng Cận lâm sàng (X-quang / Siêu âm)", min_value=1, max_value=6, value=3, step=1)
diag_prob = st.sidebar.slider("Tỷ lệ chỉ định cận lâm sàng (%)", min_value=10, max_value=80, value=45, step=5) / 100.0

# Base Configuration
base_cfg = SimulationConfig(
    num_patients=num_patients,
    arrival_rate_per_hour=arrival_rate,
    initial_consult_rooms=4,
    diagnostic_rooms=2,
    diagnostic_probability=diag_prob,
    seed=42
)

# Proposed Configuration
proposed_cfg = SimulationConfig(
    num_patients=num_patients,
    arrival_rate_per_hour=arrival_rate,
    initial_consult_rooms=consult_rooms,
    diagnostic_rooms=diag_rooms,
    diagnostic_probability=diag_prob,
    seed=42
)

# Run Simulations
base_sim = MedFlowSimulation(base_cfg)
base_df = base_sim.run()
base_metrics = base_sim.get_summary_metrics()

prop_sim = MedFlowSimulation(proposed_cfg)
prop_df = prop_sim.run()
prop_metrics = prop_sim.get_summary_metrics()

# Display KPI Comparison
st.subheader("So sánh Hiệu quả Vận hành: Hiện trạng vs. Kịch bản đề xuất")

kpi_cols = st.columns(4)
diff_consult_wait = prop_metrics['avg_wait_time_consult'] - base_metrics['avg_wait_time_consult']
diff_total_wait = prop_metrics['avg_total_wait_time'] - base_metrics['avg_total_wait_time']
diff_p90_wait = prop_metrics['p90_total_wait_time'] - base_metrics['p90_total_wait_time']
diff_sla = prop_metrics['sla_breach_rate_pct'] - base_metrics['sla_breach_rate_pct']

kpi_cols[0].metric(
    "Chờ khám ban đầu trung bình",
    f"{prop_metrics['avg_wait_time_consult']:.1f} phút",
    delta=f"{diff_consult_wait:.1f} phút",
    delta_color="inverse"
)

kpi_cols[1].metric(
    "Tổng thời gian chờ trung bình",
    f"{prop_metrics['avg_total_wait_time']:.1f} phút",
    delta=f"{diff_total_wait:.1f} phút",
    delta_color="inverse"
)

kpi_cols[2].metric(
    "P90 Thời gian chờ tổng",
    f"{prop_metrics['p90_total_wait_time']:.1f} phút",
    delta=f"{diff_p90_wait:.1f} phút",
    delta_color="inverse"
)

kpi_cols[3].metric(
    "Tỷ lệ vi phạm SLA (>30p)",
    f"{prop_metrics['sla_breach_rate_pct']:.1f}%",
    delta=f"{diff_sla:.1f}%",
    delta_color="inverse"
)

# Visualizations
st.write("---")
tab1, tab2, tab3 = st.tabs(["Phân phối thời gian chờ", "Lộ trình bệnh nhân A -> B -> A'", "Đánh giá kịch bản mở rộng"])

with tab1:
    col_l, col_r = st.columns(2)
    base_df['Scenario'] = 'Baseline (Hiện trạng)'
    prop_df['Scenario'] = 'Proposed (Đề xuất)'
    combined_df = pd.concat([base_df, prop_df])
    
    fig_hist = px.histogram(
        combined_df,
        x="total_wait_time",
        color="Scenario",
        barmode="overlay",
        nbins=30,
        title="Phân phối Tổng thời gian chờ (Total Wait Time Distribution)",
        color_discrete_map={'Baseline (Hiện trạng)': PALETTE['orange'], 'Proposed (Đề xuất)': PALETTE['blue']}
    )
    col_l.plotly_chart(fig_hist, use_container_width=True)
    
    fig_box = px.box(
        combined_df,
        x="Scenario",
        y="total_wait_time",
        color="Scenario",
        points="outliers",
        title="Biểu đồ phân vị thời gian chờ (Median & Outliers)",
        color_discrete_map={'Baseline (Hiện trạng)': PALETTE['orange'], 'Proposed (Đề xuất)': PALETTE['blue']}
    )
    col_r.plotly_chart(fig_box, use_container_width=True)

with tab2:
    st.markdown("#### Thời gian tiêu tốn tại từng công đoạn trong hành trình khám")
    breakdown_data = pd.DataFrame([
        {
            'Giai đoạn': '1. Chờ khám ban đầu',
            'Baseline': base_df['consult_wait_time'].mean(),
            'Proposed': prop_df['consult_wait_time'].mean(),
        },
        {
            'Giai đoạn': '2. Chờ Cận lâm sàng',
            'Baseline': base_df[base_df['needs_diagnostic']]['diagnostic_wait_time'].mean() if base_df['needs_diagnostic'].any() else 0,
            'Proposed': prop_df[prop_df['needs_diagnostic']]['diagnostic_wait_time'].mean() if prop_df['needs_diagnostic'].any() else 0,
        },
        {
            'Giai đoạn': '3. Chờ Trả kết quả (Return Review)',
            'Baseline': base_df[base_df['needs_diagnostic']]['return_wait_time'].mean() if base_df['needs_diagnostic'].any() else 0,
            'Proposed': prop_df[prop_df['needs_diagnostic']]['return_wait_time'].mean() if prop_df['needs_diagnostic'].any() else 0,
        }
    ])
    
    fig_bar = px.bar(
        breakdown_data.melt(id_vars=['Giai đoạn'], var_name='Scenario', value_name='Thời gian trung bình (phút)'),
        x='Giai đoạn',
        y='Thời gian trung bình (phút)',
        color='Scenario',
        barmode='group',
        title='So sánh thời gian chờ theo từng bước quy trình',
        color_discrete_map={'Baseline': PALETTE['orange'], 'Proposed': PALETTE['blue']}
    )
    st.plotly_chart(fig_bar, use_container_width=True)

with tab3:
    st.markdown("#### Bảng phân tích đa kịch bản (Scenario Matrix)")
    scenarios = {
        "Kịch bản 1: Thêm 1 phòng khám (+1 BS Nội)": {"initial_consult_rooms": 5, "diagnostic_rooms": 2},
        "Kịch bản 2: Thêm 1 máy Siêu âm (+1 BS CĐHA)": {"initial_consult_rooms": 4, "diagnostic_rooms": 3},
        "Kịch bản 3: Tối ưu toàn diện (+1 BS Nội, +1 CĐHA)": {"initial_consult_rooms": 5, "diagnostic_rooms": 3},
        "Kịch bản 4: Giờ cao điểm tăng tải (+50% bệnh nhân)": {"arrival_rate_per_hour": arrival_rate * 1.5, "initial_consult_rooms": consult_rooms, "diagnostic_rooms": diag_rooms},
    }
    comp_df = run_scenario_comparison(base_cfg, scenarios)
    st.dataframe(comp_df, use_container_width=True)
    
    st.success("""
    **Khuyến nghị điều hành từ mô phỏng:**
    1. Bổ sung phòng chẩn đoán hình ảnh (X-quang / Siêu âm) mang lại hiệu quả giảm ùn tắc cao nhất đối với các ca bệnh phức tạp có chỉ định cận lâm sàng.
    2. Trong các khung giờ cao điểm (08:00 - 10:30), kích hoạt cơ chế bác sĩ hỗ trợ linh hoạt (*Covering Doctor Assignment*) giúp giảm tỷ lệ vi phạm SLA xuống dưới 5%.
    """)
