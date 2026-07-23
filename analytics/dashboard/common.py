from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

ANALYTICS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ANALYTICS_ROOT.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from analytics.src.extract import load_tasks
from analytics.src.metrics import journey_summary, prepare_tasks

PALETTE = {"blue":"#1677A6", "orange":"#E58245", "gold":"#C9A227", "ink":"#243746", "muted":"#6B7C87"}


@st.cache_data(ttl=300, show_spinner=False)
def load_dashboard_data(prefer_live: bool = True):
    raw, source = load_tasks(prefer_live=prefer_live)
    return prepare_tasks(raw), journey_summary(raw), source


def sidebar_filters(frame: pd.DataFrame) -> pd.DataFrame:
    st.sidebar.header("Bộ lọc")
    result = frame.copy()
    if "event_date" in result and result["event_date"].notna().any():
        minimum, maximum = min(result["event_date"].dropna()), max(result["event_date"].dropna())
        selected = st.sidebar.date_input("Khoảng ngày", value=(minimum, maximum), min_value=minimum, max_value=maximum)
        if isinstance(selected, (tuple, list)) and len(selected) == 2:
            result = result[result["event_date"].between(selected[0], selected[1])]
    for column, label in [("room_name", "Phòng"), ("service_type", "Dịch vụ"), ("clinical_priority", "Ưu tiên"), ("task_type", "Bước khám"), ("resource_status", "Resource")]:
        if column in result and result[column].notna().any():
            options = sorted(result[column].dropna().astype(str).unique())
            chosen = st.sidebar.multiselect(label, options)
            if chosen:
                result = result[result[column].astype(str).isin(chosen)]
    return result


def header(title: str, source: str) -> None:
    st.title(title)
    badge = "LIVE/SEEDED DATABASE" if source.startswith("PostgreSQL") else "SYNTHETIC DEMO"
    st.caption(f"Nguồn: {source} · Chế độ: {badge} · Cache tối đa 5 phút")


def empty_guard(frame: pd.DataFrame) -> None:
    if frame.empty:
        st.warning("Không có dữ liệu phù hợp với bộ lọc hiện tại.")
        st.stop()

