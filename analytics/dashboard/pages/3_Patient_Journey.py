from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import plotly.express as px
import streamlit as st
from analytics.dashboard.common import PALETTE, empty_guard, header, load_dashboard_data, sidebar_filters
from analytics.src.metrics import journey_summary

st.set_page_config(page_title="Patient Journey", layout="wide")
tasks, _, source = load_dashboard_data(True)
filtered = sidebar_filters(tasks); empty_guard(filtered); header("Patient Journey: A → B → quay lại A", source)
steps = filtered.groupby("task_type", as_index=False).agg(tasks=("task_id","nunique"), median_wait=("operational_wait_minutes","median"), median_service=("service_duration_minutes","median"))
order = ["INITIAL_CONSULT","DIAGNOSTIC_SERVICE","RETURN_REVIEW"]
steps["order"] = steps["task_type"].map({v:i for i,v in enumerate(order)}).fillna(99); steps = steps.sort_values("order")
st.plotly_chart(px.bar(steps, x="task_type", y="tasks", color="median_wait", title="Task theo bước và median wait", color_continuous_scale=[[0,"#D8EAF2"],[1,PALETTE['orange']]]), use_container_width=True)
journeys = journey_summary(filtered)
left, right, third = st.columns(3)
left.metric("Journey", f"{len(journeys):,}")
right.metric("A → B → Return", f"{int(journeys['has_a_b_return'].sum()):,}" if not journeys.empty else "0")
third.metric("Median completion", f"{journeys['journey_completion_minutes'].median():.1f} phút" if not journeys.empty else "—")
if not journeys.empty:
    st.plotly_chart(px.histogram(journeys, x="journey_completion_minutes", color="has_a_b_return", nbins=20, title="Phân phối journey completion time", color_discrete_sequence=[PALETTE['blue'], PALETTE['orange']]), use_container_width=True)
detail_columns = [c for c in ["journey_id","patient_alias","task_type","service_type","status","room_name","operational_wait_minutes","service_duration_minutes","result_turnaround_minutes"] if c in filtered]
st.dataframe(filtered[detail_columns].sort_values(["journey_id","task_type"]), use_container_width=True, hide_index=True)
if not steps.empty:
    bottleneck = steps.sort_values("median_wait", ascending=False).iloc[0]
    st.info(f"Bottleneck theo median wait trong phạm vi lọc: {bottleneck['task_type']} ({bottleneck['median_wait']:.1f} phút).")
