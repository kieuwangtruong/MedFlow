from __future__ import annotations

import html
import re
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from analytics.src.data_quality import save_profile
from analytics.src.extract import load_tasks
from analytics.src.metrics import journey_summary, kpis, prepare_tasks

ANALYTICS = ROOT / "analytics"; OUTPUTS = ANALYTICS / "outputs"; REPORTS = ANALYTICS / "reports"; FIGURES = REPORTS / "figures"
for path in [OUTPUTS, REPORTS, FIGURES]: path.mkdir(parents=True, exist_ok=True)


def fmt(value, suffix=""):
    return "n/a" if pd.isna(value) else f"{value:,.1f}{suffix}"


raw, source = load_tasks(prefer_live=True)
tasks = prepare_tasks(raw); summary = kpis(tasks); journeys = journey_summary(tasks)
quality = save_profile(raw, OUTPUTS)
baseline_path = OUTPUTS / "baseline_comparison.csv"
baseline = pd.read_csv(baseline_path) if baseline_path.exists() else pd.DataFrame()

room_col = "room_name" if "room_name" in tasks and tasks["room_name"].notna().any() else "queue_id"
tasks[room_col] = tasks[room_col].fillna(tasks.get("queue_id")).fillna("UNASSIGNED")
rooms = tasks.groupby(room_col, dropna=False).agg(tasks=("task_id","nunique"), median_wait=("operational_wait_minutes","median"), p90_wait=("operational_wait_minutes",lambda s:s.quantile(.9)), breach=("sla_breach","mean")).reset_index().sort_values("p90_wait",ascending=False)
steps = tasks.groupby("task_type", dropna=False).agg(tasks=("task_id","nunique"), median_wait=("operational_wait_minutes","median"), median_service=("service_duration_minutes","median")).reset_index().sort_values("median_wait",ascending=False)

fig, ax = plt.subplots(figsize=(9,4.5)); rooms.head(10).sort_values("p90_wait").plot.barh(x=room_col,y="p90_wait",legend=False,color="#1677A6",ax=ax); ax.set(title="P90 operational wait by room/queue",xlabel="Minutes",ylabel=""); fig.tight_layout(); fig.savefig(FIGURES/"room_p90.png",dpi=160); plt.close(fig)
if not baseline.empty:
    fig, ax = plt.subplots(figsize=(9,4.5)); baseline.plot.bar(x="scenario",y=["median_wait","p80_wait","p90_wait"],color=["#1677A6","#C9A227","#E58245"],ax=ax); ax.set(title="Baseline wait-time comparison",ylabel="Minutes",xlabel=""); ax.tick_params(axis='x',rotation=0); fig.tight_layout(); fig.savefig(FIGURES/"baseline_comparison.png",dpi=160); plt.close(fig)

top_room = rooms.iloc[0] if not rooms.empty else None
top_step = steps.iloc[0] if not steps.empty else None
def markdown_table(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "Baseline chưa được chạy."
    display = frame.round(3).astype(str)
    header = "| " + " | ".join(display.columns) + " |"
    divider = "| " + " | ".join(["---"] * len(display.columns)) + " |"
    rows = ["| " + " | ".join(row) + " |" for row in display.itertuples(index=False, name=None)]
    return "\n".join([header, divider, *rows])


baseline_table = markdown_table(baseline)
report = f"""# Báo cáo vận hành hàng đợi bệnh viện VAIC

## Executive Summary

- **Dữ liệu hiện có đủ để demo một pipeline DA end-to-end, nhưng chưa đủ để suy luận hiệu quả lâm sàng.** Nguồn phân tích: `{source}`, gồm {summary['tasks']} task và {summary['journeys']} journey.
- **Tail wait cần được quản trị cùng median.** Median operational wait là {fmt(summary['median_wait'],' phút')}, P80 {fmt(summary['p80_wait'],' phút')} và P90 {fmt(summary['p90_wait'],' phút')}; SLA breach theo ngưỡng demo là {fmt(summary['sla_breach_rate']*100,'%')}.
- **Journey A → B → quay lại A đã đo được ở cấp task.** Có {int(journeys['has_a_b_return'].sum()) if not journeys.empty else 0} journey đủ ba bước trong extract hiện tại; median completion là {fmt(summary['median_journey_minutes'],' phút')}. Average bị ảnh hưởng mạnh bởi journey kéo dài qua ngày nên chỉ giữ trong output audit.
- **Khuyến nghị ưu tiên chất lượng timestamp và resource events trước khi tối ưu vận hành thật.** Có {quality['failed_checks']} quality check phát hiện failure; metric vẫn cần được xác nhận với nghiệp vụ bệnh viện.

## 1. Business question và phạm vi

Báo cáo trả lời năm câu hỏi: bệnh nhân chờ bao lâu; phòng/dịch vụ/khung giờ nào tạo tail wait; SLA và no-show ở mức nào; resource failure và emergency insertion đi cùng thay đổi wait ra sao; và bước nào kéo dài hành trình khám ban đầu → chụp chiếu/xét nghiệm → quay lại bác sĩ kết luận.

Phạm vi là dữ liệu task hiện có trong PostgreSQL hoặc seeded CSV fallback. Đơn vị chính là **task**, còn tổng bệnh nhân/journey dùng `COUNT DISTINCT journey_id` để tránh join one-to-many làm phồng số liệu.

## 2. Data, assumptions và chất lượng

Operational wait được tính từ thời điểm muộn hơn giữa `ready_at` và `arrival_time` đến `service_start`. Physical wait được giữ riêng. Journey completion tính từ check-in đến thời điểm hoàn thành cuối cùng. SLA EMERGENCY/URGENT/NORMAL/NON_URGENT lần lượt là 5/15/30/60 phút và được gắn nhãn **demo assumption**.

Quality profile kiểm tra uniqueness, missing field chính, timestamp parse, thứ tự timestamp, duration âm và enum priority. Kết quả: {quality['failed_checks']}/{quality['quality_checks']} check có failure; tổng failure critical/high là {quality['critical_or_high_failures']}. Các lỗi này có thể làm sai percentile, SLA và journey duration, vì vậy dashboard không nên dùng cho điều hành thật trước khi remediation.

## 3. Wait time và bottleneck

**P90 cho thấy trải nghiệm đuôi dài rõ hơn median.** Phòng/queue có P90 cao nhất trong extract là **{top_room[room_col] if top_room is not None else 'n/a'}**, P90 {fmt(top_room['p90_wait'],' phút') if top_room is not None else 'n/a'}, trên {int(top_room['tasks']) if top_room is not None else 0} task. Cần đối chiếu volume, staffing và failure events trước khi quy nguyên nhân.

![P90 operational wait](figures/room_p90.png)

**Bước hành trình có median wait cao nhất là {top_step['task_type'] if top_step is not None else 'n/a'}.** Median wait tại bước này là {fmt(top_step['median_wait'],' phút') if top_step is not None else 'n/a'}. `RESULT_PENDING` phải được xem là future workload thay vì hard queue; nếu không dashboard sẽ phóng đại backlog vật lý.

## 4. SLA, no-show và resource pressure

SLA breach hiện là {fmt(summary['sla_breach_rate']*100,'%')} trên các task có wait đo được. No-show rate là {fmt(summary['no_show_rate']*100,'%')} trên task không bị cancel. Resource failure comparison trong SQL là association mô tả; không được diễn giải là failure “gây ra” phần chờ tăng nếu chưa có counterfactual hoặc event timeline đầy đủ.

Emergency insertion được đánh giá theo hai lớp: mô tả trên dữ liệu task và simulation giữ cùng workload. Chỉ simulation mới chủ động bật/tắt emergency để đo số bệnh nhân NORMAL bị tăng wait trong điều kiện giả lập.

## 5. Baseline comparison

Ba chiến lược dùng cùng workload, random seed, arrival và service duration: FCFS; Priority Queue; Queue Engine + Routing. Kết quả dưới đây là trung bình nhiều lần chạy synthetic, phục vụ đánh giá thuật toán chứ không đại diện hiệu quả bệnh viện thật.

{baseline_table}

{"![Baseline comparison](figures/baseline_comparison.png)" if not baseline.empty else ""}

**Cách đọc:** chiến lược tốt cần giảm P80/P90 và SLA breach mà không làm fairness của nhóm NORMAL xấu đi. Throughput, journey completion, P90−P50 spread và coefficient of variation phải được xem đồng thời, tránh tối ưu một KPI duy nhất.

## 6. Recommendations

1. Chuẩn hóa event contract cho `arrival_at`, `eligible_at`, `ready_at`, `service_start`, `service_end`, `result_ready_at` và `return_arrived_at`.
2. Thu thập resource event theo thời gian: bác sĩ nghỉ, máy hỏng, thời điểm phục hồi và capacity thực tế.
3. Đưa P80/P90, SLA breach và backlog minutes vào daily room-operation review; không chỉ dùng average.
4. Tách dashboard phòng dịch vụ và dashboard return review, nhưng nối bằng `journey_id` và dependency task.
5. Chạy shadow evaluation Queue Engine + Routing trên workload thật trước khi thay đổi thứ tự phục vụ.
6. Xác nhận SLA và fairness definition với bệnh viện trước khi biến metric demo thành KPI vận hành.

## 7. Further questions

- SLA chính thức có khác theo service, priority, giờ làm việc và phòng hay không?
- Thời điểm bệnh nhân thực sự có mặt tại từng phòng được ghi từ kiosk, app hay thao tác nhân viên?
- Resource failure có timestamp bắt đầu/kết thúc đủ chính xác để ghép với wait time không?
- Return review có bắt buộc về bác sĩ ban đầu hay có thể được covering doctor xử lý?

## 8. Limitations và kế hoạch dữ liệu thật

Dataset hiện có nhỏ và trộn dữ liệu seeded với vận hành demo. `room_id` có thể thiếu ở task cũ, resource status enum còn hạn chế và routing strategy chưa được ghi thành experiment assignment. Các so sánh trước/sau vì vậy chưa phải causal analysis.

Kế hoạch dữ liệu thật: log immutable queue events; lưu policy/routing version; snapshot resource capacity 5 phút; ghi physical location/presence; thêm reason code cho no-show/cancel/override; và chạy tối thiểu bốn tuần shadow mode trước khi đánh giá uplift. Báo cáo nên được refresh sau khi đạt coverage timestamp ≥95% và orphan/duplicate critical bằng 0.
"""

(REPORTS/"DA_REPORT.md").write_text(report,encoding="utf-8")
def inline_markdown(value: str) -> str:
    escaped = html.escape(value)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"`(.+?)`", r"<code>\1</code>", escaped)
    return escaped


def markdown_body(lines: list[str]) -> str:
    output=[]; index=0
    while index < len(lines):
        line=lines[index].strip()
        if not line:
            index += 1; continue
        image_match=re.fullmatch(r"!\[(.*?)\]\((.*?)\)", line)
        if image_match:
            output.append(f"<figure><img src='{html.escape(image_match.group(2))}' alt='{html.escape(image_match.group(1))}'><figcaption>{html.escape(image_match.group(1))}</figcaption></figure>")
            index += 1; continue
        if line.startswith("| ") and index + 1 < len(lines) and re.match(r"^\|\s*:?-+", lines[index+1].strip()):
            headers=[cell.strip() for cell in line.strip("|").split("|")]
            index += 2; rows=[]
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append([cell.strip() for cell in lines[index].strip().strip("|").split("|")]); index += 1
            head="".join(f"<th>{inline_markdown(cell)}</th>" for cell in headers)
            body="".join("<tr>"+"".join(f"<td>{inline_markdown(cell)}</td>" for cell in row)+"</tr>" for row in rows)
            output.append(f"<div class='table-wrap'><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>")
            continue
        if line.startswith("- "):
            items=[]
            while index < len(lines) and lines[index].strip().startswith("- "):
                items.append(f"<li>{inline_markdown(lines[index].strip()[2:])}</li>"); index += 1
            output.append("<ul>"+"".join(items)+"</ul>"); continue
        if re.match(r"^\d+\.\s", line):
            items=[]
            while index < len(lines) and re.match(r"^\d+\.\s", lines[index].strip()):
                items.append(f"<li>{inline_markdown(re.sub(r'^\d+\.\s*','',lines[index].strip()))}</li>"); index += 1
            output.append("<ol>"+"".join(items)+"</ol>"); continue
        paragraph=[line]; index += 1
        while index < len(lines) and lines[index].strip() and not lines[index].strip().startswith(("- ","|","![")) and not re.match(r"^\d+\.\s",lines[index].strip()):
            paragraph.append(lines[index].strip()); index += 1
        output.append("<p>"+inline_markdown(" ".join(paragraph))+"</p>")
    return "".join(output)


sections=[]
blocks=report.split("\n## ")
for block in blocks[1:]:
    lines=block.splitlines(); title=lines[0].strip(); body=markdown_body(lines[1:])
    sections.append(f"<section><h2>{html.escape(title)}</h2>{body}</section>")
document=f"""<!doctype html><html lang='vi'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>Báo cáo vận hành hàng đợi bệnh viện VAIC</title><style>body{{font:16px/1.65 system-ui;margin:auto;max-width:980px;padding:32px;color:#243746}}h1,h2{{color:#123b52}}h1{{font-size:2rem}}h2{{margin-top:2.4rem}}section{{margin:42px 0}}li{{margin:.45rem 0}}code{{background:#eef3f6;padding:.1rem .3rem;border-radius:4px}}figure{{margin:1.5rem 0}}figcaption{{color:#6b7c87;font-size:.9rem}}img{{max-width:100%;border:1px solid #d9e2e8;border-radius:8px}}.table-wrap{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:.88rem}}th,td{{padding:.55rem;border-bottom:1px solid #d9e2e8;text-align:right}}th:first-child,td:first-child{{text-align:left}}thead{{background:#eef3f6}}@media print{{section{{break-inside:avoid}}body{{font-size:11pt}}}}</style></head><body><h1>Báo cáo vận hành hàng đợi bệnh viện VAIC</h1>{''.join(sections)}</body></html>"""
(REPORTS/"DA_REPORT.html").write_text(document,encoding="utf-8")
print(REPORTS/"DA_REPORT.html")
