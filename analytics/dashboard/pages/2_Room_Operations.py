from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import plotly.express as px
import streamlit as st
from analytics.dashboard.common import PALETTE, empty_guard, header, load_dashboard_data, sidebar_filters

st.set_page_config(page_title="Room Operations", layout="wide")
tasks, _, source = load_dashboard_data(True)
filtered = sidebar_filters(tasks); empty_guard(filtered); header("Room Operations", source)
filtered = filtered.assign(room=filtered.get("room_name").fillna(filtered.get("queue_id")).fillna("UNASSIGNED"))
active_states = ["PENDING","READY","IN_QUEUE","IN_SERVICE","WAITING_RESULT"]
rooms = filtered.groupby("room", as_index=False).agg(tasks=("task_id","nunique"), backlog=("status",lambda s: s.isin(active_states).sum()), median_wait=("operational_wait_minutes","median"), queue_length=("queue_length","max"), failures=("resource_failure","sum"))
st.plotly_chart(px.bar(rooms.sort_values("backlog", ascending=False), x="room", y="backlog", color="median_wait", title="Backlog và median wait theo phòng", color_continuous_scale=[[0,"#D8EAF2"],[1,PALETTE['blue']]]), use_container_width=True)
heat = filtered.dropna(subset=["event_hour"]).pivot_table(index="room", columns="event_hour", values="task_id", aggfunc="nunique", fill_value=0)
st.plotly_chart(px.imshow(heat, aspect="auto", labels={"x":"Giờ trong ngày", "y":"Phòng", "color":"Task"}, title="Heatmap tải phòng theo giờ", color_continuous_scale=[[0,"#F3F6F8"],[1,PALETTE['orange']]]), use_container_width=True)
left, right = st.columns(2)
left.dataframe(rooms.sort_values(["backlog","median_wait"], ascending=False), use_container_width=True, hide_index=True)
failure = filtered.groupby("resource_failure", as_index=False)["operational_wait_minutes"].agg(["count","median","mean"]).reset_index()
right.dataframe(failure, use_container_width=True, hide_index=True)
st.caption("Resource-failure comparison is observational; use the controlled baseline simulation for causal-adjacent comparison.")
