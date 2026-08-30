from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from analytics.dashboard.common import PALETTE, empty_guard, header, load_dashboard_data, sidebar_filters
from analytics.src.metrics import bottleneck_3step_analysis, journey_summary

st.set_page_config(page_title="Patient Journey & Bottlenecks - MedFlow", page_icon="🔄", layout="wide")

tasks, _, source = load_dashboard_data(prefer_live=True)
filtered = sidebar_filters(tasks)
empty_guard(filtered)
header("🔄 Patient Journey & Bottlenecks (Hành Trình Khám & Luồng 3 Bước A → B → A')", source)

journeys = journey_summary(filtered)
bottlenecks = bottleneck_3step_analysis(filtered)

# Row 1: Key Metrics of 3-Step Journey
c1, c2, c3, c4 = st.columns(4)
c1.metric("Tổng Số Hành Trình", f"{len(journeys):,}")
aba_count = int(journeys['has_a_b_return'].sum()) if not journeys.empty else 0
c2.metric("Luồng Khám A → B → A'", f"{aba_count:,}", f"{aba_count/len(journeys)*100:.1f}%" if len(journeys) else "0%")
med_los = journeys['journey_completion_minutes'].median() if not journeys.empty else np.nan
c3.metric("Median Lưu Viện (LOS)", f"{med_los:.1f} phút" if pd.notna(med_los) else "—")
turnaround_p50 = bottlenecks.get("result_turnaround_p50", np.nan)
c4.metric("Thời Gian Chờ Trả Kết Quả", f"{turnaround_p50:.1f} phút" if pd.notna(turnaround_p50) else "—")

st.markdown("---")

# Row 2: 3-Step Bottleneck Breakdown & Journey LOS Histogram
col_flow, col_dist = st.columns(2)

with col_flow:
    st.subheader("📊 Thời Gian Chờ Vận Hành Theo 3 Giai Đoạn Khám")
    step_data = []
    step_names = {
        "INITIAL_CONSULT": "1. Khám Ban Đầu (A)",
        "DIAGNOSTIC_SERVICE": "2. Cận Lâm Sàng / CĐHA (B)",
        "RETURN_REVIEW": "3. Tái Khám Đọc Kết Quả (A')",
    }
    for step_code, step_label in step_names.items():
        metrics = bottlenecks["step_metrics"].get(step_code, {})
        step_data.append({
            "Giai Đoạn": step_label,
            "Median Wait (P50)": metrics.get("median_wait", 0.0),
            "P80 Wait": metrics.get("p80_wait", 0.0),
            "P90 Wait": metrics.get("p90_wait", 0.0),
            "Thời Gian Khám": metrics.get("median_duration", 0.0),
        })
    step_df = pd.DataFrame(step_data)
    
    fig_steps = go.Figure()
    fig_steps.add_trace(go.Bar(name="Median Wait", x=step_df["Giai Đoạn"], y=step_df["Median Wait (P50)"], marker_color="#3B82F6"))
    fig_steps.add_trace(go.Bar(name="P80 Wait", x=step_df["Giai Đoạn"], y=step_df["P80 Wait"], marker_color="#F59E0B"))
    fig_steps.add_trace(go.Bar(name="Thời Gian Phục Vụ", x=step_df["Giai Đoạn"], y=step_df["Thời Gian Khám"], marker_color="#10B981"))
    fig_steps.update_layout(barmode="group", template="plotly_white", yaxis_title="Phút")
    st.plotly_chart(fig_steps, use_container_width=True)

with col_dist:
    st.subheader("⏱️ Phân Phối Tổng Thời Gian Lưu Viện Của Bệnh Nhân")
    if not journeys.empty and journeys["journey_completion_minutes"].notna().any():
        fig_hist = px.histogram(
            journeys.dropna(subset=["journey_completion_minutes"]),
            x="journey_completion_minutes",
            color="has_a_b_return",
            nbins=20,
            title="Histogram Thời Gian Lưu Viện (LOS: Check-in → Ra Viện)",
            labels={"journey_completion_minutes": "Tổng Thời Gian (Phút)", "has_a_b_return": "Có Luồng A → B → A'"},
            color_discrete_map={True: "#F59E0B", False: "#3B82F6"},
        )
        fig_hist.update_layout(template="plotly_white")
        st.plotly_chart(fig_hist, use_container_width=True)
    else:
        st.info("Chưa có đủ dữ liệu hành trình.")

st.markdown("---")

# Row 3: Granular Patient Journey Table Drill-down
st.subheader("🔍 Chi Tiết Từng Lượt Khám & Bước Khám (Patient Journey Drill-Down)")
detail_cols = [
    "journey_id", "patient_alias", "task_type", "service_type", "status",
    "room_name", "operational_wait_minutes", "service_duration_minutes",
    "result_turnaround_minutes", "is_sla_breach"
]
available_cols = [c for c in detail_cols if c in filtered]
st.dataframe(filtered[available_cols].sort_values(["journey_id"]), use_container_width=True, hide_index=True)
