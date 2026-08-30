from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import pandas as pd
import plotly.express as px
import streamlit as st

from analytics.dashboard.common import (
    empty_guard,
    header,
    load_dashboard_data,
    sidebar_filters,
)

st.set_page_config(page_title="Room Operations & Bottlenecks - MedFlow", page_icon="🏥", layout="wide")

tasks, _, source = load_dashboard_data(prefer_live=True)
filtered = sidebar_filters(tasks)
empty_guard(filtered)
header("🏥 Room Operations & Bottlenecks (Vận Hành Buồng Khám & Nút Thắt Cổ Chai)", source)

filtered = filtered.assign(room=filtered.get("room_name").fillna(filtered.get("queue_id")).fillna("UNASSIGNED"))

# Row 1: Heatmap of hourly room load
st.subheader("🔥 Heatmap Mật Độ Tải Phòng Khám Theo Giờ (Hourly Room Load)")
heat_data = filtered.dropna(subset=["event_hour"]).pivot_table(
    index="room",
    columns="event_hour",
    values="task_id",
    aggfunc="nunique",
    fill_value=0,
)

if not heat_data.empty:
    fig_heat = px.imshow(
        heat_data,
        aspect="auto",
        labels={"x": "Khung Giờ Trong Ngày (24h)", "y": "Phòng Khám / Thiết Bị", "color": "Lượt Khám"},
        color_continuous_scale=[[0, "#F8FAFC"], [0.5, "#93C5FD"], [1, "#1E40AF"]],
    )
    fig_heat.update_layout(template="plotly_white", height=320)
    st.plotly_chart(fig_heat, use_container_width=True)
else:
    st.info("Chưa có đủ dữ liệu khung giờ.")

st.markdown("---")

# Row 2: Queue Length vs Wait Correlation & Resource Failure Impact
c_left, c_right = st.columns(2)

with c_left:
    st.subheader("📈 Tương Quan Độ Dài Hàng Đợi vs Thời Gian Chờ")
    if "queue_length" in filtered and filtered["queue_length"].notna().any():
        fig_scatter = px.scatter(
            filtered,
            x="queue_length",
            y="operational_wait_minutes",
            color="clinical_priority",
            trendline="ols",
            title="Độ Dài Hàng Đợi Lúc Bệnh Nhân Đến vs Thời Gian Chờ Thực Tế",
            labels={"queue_length": "Số Người Đang Xếp Hàng", "operational_wait_minutes": "Thời Gian Chờ (Phút)"},
            color_discrete_map={"EMERGENCY": "#EF4444", "URGENT": "#F59E0B", "NORMAL": "#3B82F6", "NON_URGENT": "#10B981"},
        )
        fig_scatter.update_layout(template="plotly_white")
        st.plotly_chart(fig_scatter, use_container_width=True)
    else:
        st.info("Chưa có dữ liệu độ dài hàng đợi.")

with c_right:
    st.subheader("⚠️ Phân Tích Tác Động Khi Sự Cố Thiết Bị / Ca Cấp Cứu")
    failure_grp = filtered.groupby("resource_failure", as_index=False).agg(
        total_tasks=("task_id", "count"),
        median_wait=("operational_wait_minutes", "median"),
        mean_wait=("operational_wait_minutes", "mean"),
        p80_wait=("operational_wait_minutes", lambda s: s.quantile(0.80)),
    )
    failure_grp["Trạng Thái Vận Hành"] = failure_grp["resource_failure"].map({True: "⚠️ Có Sự Cố Thiết Bị / Tạm Dừng", False: "✅ Hoạt Động Bình Thường"})
    
    fig_failure = px.bar(
        failure_grp,
        x="Trạng Thái Vận Hành",
        y="p80_wait",
        color="Trạng Thái Vận Hành",
        title="Thời Gian Chờ P80: Bình Thường vs Khi Có Sự Cố",
        labels={"p80_wait": "Thời Gian Chờ P80 (Phút)"},
        color_discrete_map={"✅ Hoạt Động Bình Thường": "#10B981", "⚠️ Có Sự Cố Thiết Bị / Tạm Dừng": "#EF4444"},
    )
    fig_failure.update_layout(template="plotly_white", showlegend=False)
    st.plotly_chart(fig_failure, use_container_width=True)

st.markdown("---")

# Row 3: Room Summary Performance Table
st.subheader("📋 Bảng Tổng Hợp Hiệu Suất Theo Buồng Khám")
if "status" not in filtered:
    filtered["status"] = filtered.get("readiness_status", pd.Series("COMPLETED", index=filtered.index)).fillna("COMPLETED")

active_states = ["PENDING", "READY", "IN_QUEUE", "IN_SERVICE", "WAITING_RESULT"]
rooms_table = filtered.groupby("room", as_index=False).agg(
    tasks=("task_id", "nunique"),
    active_backlog=("status", lambda s: s.isin(active_states).sum()),
    median_wait=("operational_wait_minutes", "median"),
    p80_wait=("operational_wait_minutes", lambda s: s.quantile(0.80)),
    mean_duration=("service_duration_minutes", "mean"),
    sla_breaches=("sla_breach", "sum"),
    sla_breach_rate=("sla_breach", lambda s: f"{s.mean()*100:.1f}%"),
)
st.dataframe(rooms_table.sort_values("tasks", ascending=False), use_container_width=True, hide_index=True)
