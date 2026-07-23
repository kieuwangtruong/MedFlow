from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import plotly.express as px
import streamlit as st
from analytics.dashboard.common import PALETTE, empty_guard, header, load_dashboard_data, sidebar_filters
from analytics.src.metrics import kpis

st.set_page_config(page_title="Executive Overview", layout="wide")
tasks, _, source = load_dashboard_data(True)
filtered = sidebar_filters(tasks); empty_guard(filtered); header("Executive Overview", source)
summary = kpis(filtered)
cols = st.columns(6)
for col, label, value in zip(cols, ["Task", "Median wait", "P80", "P90", "SLA breach", "Throughput"], [summary['tasks'], summary['median_wait'], summary['p80_wait'], summary['p90_wait'], summary['sla_breach_rate']*100, summary['completed_tasks']]):
    suffix = "%" if label == "SLA breach" else (" phút" if label in {"Median wait","P80","P90"} else "")
    col.metric(label, "—" if value != value else f"{value:,.1f}{suffix}")

daily = filtered.dropna(subset=["event_date"]).groupby("event_date", as_index=False).agg(tasks=("task_id","nunique"), median_wait=("operational_wait_minutes","median"))
left, right = st.columns(2)
left.plotly_chart(px.line(daily, x="event_date", y="tasks", markers=True, title="Số task theo ngày", color_discrete_sequence=[PALETTE['blue']]), use_container_width=True)
right.plotly_chart(px.line(daily, x="event_date", y="median_wait", markers=True, title="Median operational wait theo ngày", color_discrete_sequence=[PALETTE['orange']]), use_container_width=True)
rooms = filtered.assign(room=filtered.get("room_name").fillna(filtered.get("queue_id")).fillna("UNASSIGNED")).groupby("room", as_index=False)["operational_wait_minutes"].median().sort_values("operational_wait_minutes", ascending=False).head(10)
st.plotly_chart(px.bar(rooms, x="operational_wait_minutes", y="room", orientation="h", title="Phòng/queue có median wait cao nhất", color_discrete_sequence=[PALETTE['blue']]), use_container_width=True)
if not rooms.empty:
    st.info(f"Insight: {rooms.iloc[0]['room']} có median wait cao nhất trong phạm vi lọc ({rooms.iloc[0]['operational_wait_minutes']:.1f} phút); cần đối chiếu volume và resource trước khi kết luận nguyên nhân.")
