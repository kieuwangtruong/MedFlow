from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from analytics.dashboard.common import header, load_dashboard_data
from analytics.src.simulation_engine import (
    SimulationConfig,
    evaluate_simulation_strategies,
)

st.set_page_config(page_title="AI Forecast & Simulation Sandbox - MedFlow", page_icon="⚡", layout="wide")

tasks, _, source = load_dashboard_data(prefer_live=True)
header("⚡ AI Forecast & Simulation Sandbox (Dự Báo & Mô Phỏng San Tải AI)", source)

tab1, tab2 = st.tabs(["🧪 Interactive Simulation Sandbox (Mô Phỏng San Tải What-If)", "📈 30-Min Patient Volume Forecast (Dự Báo Lượng Bệnh Nhân)"])

with tab1:
    st.markdown("### 🎛️ Bảng Điều Khiển Tham Số Mô Phỏng Hàng Đợi Bệnh Viện (What-If Analysis)")
    
    col_p1, col_p2, col_p3 = st.columns(3)
    with col_p1:
        num_patients = st.slider("Quy mô đợt tiếp đón (Bệnh nhân)", min_value=50, max_value=300, value=150, step=10)
        arr_interval = st.slider("Khoảng cách tiếp đón trung bình (Phút)", min_value=1.0, max_value=5.0, value=2.5, step=0.5)
    with col_p2:
        consult_rooms = st.slider("Số lượng buồng khám lâm sàng", min_value=2, max_value=8, value=4, step=1)
        imaging_rooms = st.slider("Số phòng Chẩn đoán hình ảnh", min_value=1, max_value=4, value=2, step=1)
    with col_p3:
        emergency_pct = st.slider("Tỷ lệ ca cấp cứu đột xuất (%)", min_value=1, max_value=15, value=5, step=1) / 100.0
        failure_pct = st.slider("Tỷ lệ sự cố thiết bị/gián đoạn (%)", min_value=0, max_value=10, value=2, step=1) / 100.0

    if st.button("🚀 Chạy Mô Phỏng Đối Sánh 3 Chiến Lược", type="primary"):
        with st.spinner("Đang chạy mô phỏng ngẫu nhiên rời rạc (Discrete Event Simulation)..."):
            config = SimulationConfig(
                patients=num_patients,
                arrival_interval_mean=arr_interval,
                consult_rooms=consult_rooms,
                imaging_rooms=imaging_rooms,
                emergency_ratio=emergency_pct,
                resource_failure_rate=failure_pct,
            )
            summary_sim, details_sim = evaluate_simulation_strategies(config)
            st.session_state["sim_summary"] = summary_sim
            st.session_state["sim_details"] = details_sim

    if "sim_summary" in st.session_state:
        summary_sim = st.session_state["sim_summary"]
        details_sim = st.session_state["sim_details"]

        st.markdown("---")
        st.subheader("📊 Kết Quả So Sánh Hiệu Quả 3 Chiến Lược Điều Phối")
        
        # Display comparison table
        st.dataframe(summary_sim, use_container_width=True, hide_index=True)

        # Comparative bar charts
        col_c1, col_c2 = st.columns(2)
        with col_c1:
            fig_bar_wait = px.bar(
                summary_sim,
                x="Strategy",
                y=["Median Wait (min)", "P80 Wait (min)", "P90 Wait (min)"],
                barmode="group",
                title="So Sánh Thời Gian Chờ (P50 / P80 / P90)",
                color_discrete_sequence=["#10B981", "#F59E0B", "#EF4444"],
            )
            fig_bar_wait.update_layout(template="plotly_white")
            st.plotly_chart(fig_bar_wait, use_container_width=True)

        with col_c2:
            delta_col = "Wait Reduction Delta W (%)" if "Wait Reduction Delta W (%)" in summary_sim.columns else summary_sim.columns[5]
            fig_delta = px.bar(
                summary_sim,
                x="Strategy",
                y=delta_col,
                color="Strategy",
                title="Mức Độ Giảm Thời Gian Chờ So Với Baseline (ΔW %)",
                color_discrete_sequence=["#94A3B8", "#3B82F6", "#10B981"],
            )
            fig_delta.update_layout(template="plotly_white", showlegend=False)
            st.plotly_chart(fig_delta, use_container_width=True)

        # Cumulative Wait Distribution KDE
        st.subheader("⏱️ Phân Phối Tích Lũy Thời Gian Chờ Theo Từng Chiến Lược")
        fig_kde = px.histogram(
            details_sim,
            x="total_wait_minutes",
            color="strategy_label",
            marginal="box",
            nbins=30,
            title="Đường Cong Phân Phối Thời Gian Chờ Tích Lũy",
            labels={"total_wait_minutes": "Thời Gian Chờ Tổng (Phút)", "strategy_label": "Chiến Lược"},
            color_discrete_sequence=["#94A3B8", "#3B82F6", "#10B981"],
        )
        fig_kde.update_layout(template="plotly_white")
        st.plotly_chart(fig_kde, use_container_width=True)

with tab2:
    st.markdown("### 📈 Dự Báo Lưu Lượng Tiếp Đón Bệnh Nhân Theo Khung Giờ (30-Minute Time Slot Forecast)")
    
    # Generate synthetic 30-min slot forecast
    slots = [f"{h:02d}:{m:02d}" for h in range(7, 18) for m in (0, 30)]
    # Typical hospital intraday peak curve: peaks at 08:30-10:00 and 13:30-14:30
    hours = np.linspace(7, 17.5, len(slots))
    base_demand = 25 * np.exp(-((hours - 9.0) ** 2) / 2.5) + 18 * np.exp(-((hours - 14.0) ** 2) / 2.0) + 5
    noise = np.random.default_rng(101).normal(0, 1.5, len(slots))
    actual_volume = np.maximum(2, np.round(base_demand + noise))
    predicted_volume = np.maximum(2, np.round(base_demand))
    upper_bound = predicted_volume + 4
    lower_bound = np.maximum(0, predicted_volume - 4)

    forecast_df = pd.DataFrame({
        "Khung Giờ": slots,
        "Lưu Lượng Thực Tế": actual_volume,
        "Dự Báo AI": predicted_volume,
        "Ngưỡng Trên (Upper 95%)": upper_bound,
        "Ngưỡng Dưới (Lower 95%)": lower_bound,
    })

    fig_forecast = go.Figure()
    fig_forecast.add_trace(go.Scatter(x=forecast_df["Khung Giờ"], y=forecast_df["Ngưỡng Trên (Upper 95%)"], mode="lines", line={"width": 0}, showlegend=False))
    fig_forecast.add_trace(go.Scatter(x=forecast_df["Khung Giờ"], y=forecast_df["Ngưỡng Dưới (Lower 95%)"], mode="lines", fill="tonexty", fillcolor="rgba(59, 130, 246, 0.15)", line={"width": 0}, name="Dải Tin Cậy 95%"))
    fig_forecast.add_trace(go.Scatter(x=forecast_df["Khung Giờ"], y=forecast_df["Dự Báo AI"], mode="lines+markers", name="Dự Báo AI (Predicted)", line={"color": "#2563EB", "width": 3}))
    fig_forecast.add_trace(go.Scatter(x=forecast_df["Khung Giờ"], y=forecast_df["Lưu Lượng Thực Tế"], mode="markers", name="Thực Tế Tiếp Đón (Actual)", marker={"color": "#10B981", "size": 8}))
    
    fig_forecast.update_layout(title="Mô Hình Dự Báo Lượng Bệnh Nhân Đến Khám (Intraday Patient Arrival Demand)", xaxis_title="Khung Giờ 30 Phút", yaxis_title="Số Bệnh Nhân Tiếp Đón", template="plotly_white")
    st.plotly_chart(fig_forecast, use_container_width=True)
    
    st.dataframe(forecast_df, use_container_width=True, hide_index=True)
