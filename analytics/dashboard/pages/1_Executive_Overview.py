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
from analytics.src.metrics import kpis, sla_performance_by_priority, specialty_performance_breakdown

st.set_page_config(page_title="Executive Overview - MedFlow", page_icon="📊", layout="wide")

tasks, _, source = load_dashboard_data(prefer_live=True)
filtered = sidebar_filters(tasks)
empty_guard(filtered)
header("📊 Executive Operations Overview (Tổng Quan Điều Hành Toàn Viện)", source)

summary = kpis(filtered)

# Row 1: Executive KPI Cards
c1, c2, c3, c4, c5, c6 = st.columns(6)
c1.metric("Tổng Số Task", f"{summary['tasks']:,}")
c2.metric("Số Lượt Khám (Journeys)", f"{summary['journeys']:,}")
c3.metric("Median Wait (P50)", f"{summary['median_wait']:.1f} phút" if pd.notna(summary['median_wait']) else "—")
c4.metric("P80 Wait", f"{summary['p80_wait']:.1f} phút" if pd.notna(summary['p80_wait']) else "—")
c5.metric("P90 Wait", f"{summary['p90_wait']:.1f} phút" if pd.notna(summary['p90_wait']) else "—")
c6.metric("Vi Phạm SLA", f"{summary['sla_breach_rate']*100:.1f}%", delta=f"{summary['sla_breach_rate']*100:.1f}%", delta_color="inverse")

st.markdown("---")

# Row 2: Daily Volume and Wait Trends
daily = filtered.dropna(subset=["event_date"]).groupby("event_date", as_index=False).agg(
    tasks=("task_id", "nunique"),
    median_wait=("operational_wait_minutes", "median"),
    p80_wait=("operational_wait_minutes", lambda s: s.quantile(0.80)),
)

left_col, right_col = st.columns(2)

with left_col:
    fig_daily = px.line(
        daily,
        x="event_date",
        y="tasks",
        markers=True,
        title="📈 Xu Hướng Lượng Khám Theo Ngày (Daily Task Volume)",
        color_discrete_sequence=[PALETTE['blue']],
    )
    fig_daily.update_layout(xaxis_title="Ngày", yaxis_title="Số lượng task", template="plotly_white")
    st.plotly_chart(fig_daily, use_container_width=True)

with right_col:
    fig_wait = go.Figure()
    fig_wait.add_trace(go.Scatter(x=daily["event_date"], y=daily["median_wait"], mode="lines+markers", name="Median Wait (P50)", line=dict(color=PALETTE['orange'], width=3)))
    fig_wait.add_trace(go.Scatter(x=daily["event_date"], y=daily["p80_wait"], mode="lines+markers", name="P80 Wait", line=dict(color="#EF4444", dash="dash")))
    fig_wait.update_layout(title="⏱️ Xu Hướng Thời Gian Chờ Theo Ngày (P50 & P80)", xaxis_title="Ngày", yaxis_title="Phút", template="plotly_white")
    st.plotly_chart(fig_wait, use_container_width=True)

st.markdown("---")

# Row 3: Specialty Breakdown & SLA Matrix
spec_df = specialty_performance_breakdown(filtered)
sla_df = sla_performance_by_priority(filtered)

col_spec, col_sla = st.columns(2)

with col_spec:
    st.subheader("🏥 Phân Vị Thời Gian Chờ Theo Chuyên Khoa Lâm Sàng")
    if not spec_df.empty:
        fig_spec = go.Figure()
        fig_spec.add_trace(go.Bar(name="Median (P50)", y=spec_df["specialty_or_service"], x=spec_df["median_wait_p50"], orientation="h", marker_color="#10B981"))
        fig_spec.add_trace(go.Bar(name="P80 Wait", y=spec_df["specialty_or_service"], x=spec_df["wait_p80"], orientation="h", marker_color="#F59E0B"))
        fig_spec.add_trace(go.Bar(name="P90 Wait", y=spec_df["specialty_or_service"], x=spec_df["wait_p90"], orientation="h", marker_color="#EF4444"))
        fig_spec.update_layout(barmode="group", yaxis={'categoryorder': 'total ascending'}, template="plotly_white", height=420)
        st.plotly_chart(fig_spec, use_container_width=True)
    else:
        st.info("Chưa có đủ dữ liệu chuyên khoa.")

with col_sla:
    st.subheader("🎯 Tỷ Lệ Tuân Thủ SLA Theo Mức Độ Ưu Tiên")
    if not sla_df.empty:
        fig_sla = px.bar(
            sla_df,
            x="clinical_priority",
            y=["sla_compliance_rate", "sla_breach_rate"],
            barmode="stack",
            title="Tỷ Lệ Tuân Thủ (%) vs Vi Phạm SLA (%)",
            labels={"value": "Tỷ lệ (%)", "clinical_priority": "Mức ưu tiên"},
            color_discrete_map={"sla_compliance_rate": "#10B981", "sla_breach_rate": "#EF4444"},
        )
        fig_sla.update_layout(template="plotly_white", height=420)
        st.plotly_chart(fig_sla, use_container_width=True)
    else:
        st.info("Chưa có dữ liệu phân loại ưu tiên.")

# Insight Alert Banner
if not spec_df.empty:
    highest_wait_spec = spec_df.sort_values("wait_p80", ascending=False).iloc[0]
    st.success(f"💡 **Executive Insight:** Chuyên khoa có thời gian chờ P80 cao nhất là **{highest_wait_spec['specialty_or_service']}** ({highest_wait_spec['wait_p80']:.1f} phút). Tỷ lệ vi phạm SLA bình quân toàn viện hiện tại là **{summary['sla_breach_rate']*100:.1f}%**.")
