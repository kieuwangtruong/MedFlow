from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from analytics.dashboard.common import load_dashboard_data

st.set_page_config(page_title="VAIC Hospital Analytics", page_icon="🏥", layout="wide")
st.title("VAIC Hospital Operations Analytics")
st.write("Dashboard Data Analytics cho vận hành hàng đợi và hành trình A → B → quay lại A.")

prefer_live = st.toggle("Ưu tiên PostgreSQL live", value=True)
try:
    tasks, journeys, source = load_dashboard_data(prefer_live)
except Exception as error:
    st.error(f"Không thể nạp dữ liệu: {error}")
    st.stop()

left, middle, right = st.columns(3)
left.metric("Task", f"{len(tasks):,}")
middle.metric("Journey", f"{tasks['journey_id'].nunique():,}" if 'journey_id' in tasks else "0")
right.metric("A → B → Return", f"{int(journeys['has_a_b_return'].sum()):,}" if not journeys.empty else "0")
st.info(f"Nguồn hiện tại: {source}. Chọn các trang trong thanh điều hướng để xem KPI và phân tích chi tiết.")
st.markdown("""
### Metric contract

- **Operational wait:** từ thời điểm task sẵn sàng/đến phòng đến khi bắt đầu phục vụ.
- **Physical wait:** từ lúc đến vật lý đến khi bắt đầu phục vụ.
- **Journey completion:** từ check-in đến task cuối cùng hoàn thành.
- **SLA:** ngưỡng demo có cấu hình; cần thay bằng SLA bệnh viện trước khi dùng vận hành thật.
""")
