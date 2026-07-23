from __future__ import annotations

from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "analytics" / "notebooks" / "01_data_quality_eda.ipynb"


def code(source: str):
    return nbf.v4.new_code_cell(source)


def markdown(source: str):
    return nbf.v4.new_markdown_cell(source)


cells = [
    markdown("""# Hospital Queue & Patient Journey EDA

## tl;dr

Notebook này kiểm tra độ tin cậy của dữ liệu vận hành, mô tả wait time, đánh giá SLA/no-show/resource failure và xác định bottleneck trong hành trình **A → B → quay lại A**. Kết luận chỉ có giá trị mô tả đối với dữ liệu live/seeded hiện tại; baseline synthetic không phải bằng chứng nhân quả trong bệnh viện thật."""),
    markdown("""## Context & Methods

**Business questions.** Bệnh nhân chờ lâu ở đâu, khung giờ/phòng nào tạo backlog, resource failure và emergency insertion đi cùng thay đổi wait time ra sao, và bước nào kéo dài journey.

### Key Assumptions

- Múi giờ báo cáo: `Asia/Ho_Chi_Minh`.
- Operational wait = `service_start - max(ready_at, arrival_time)`; `actual_wait_time` chỉ là fallback.
- SLA demo lấy từ `analytics/config/metrics.yml` và chưa phải cam kết SLA chính thức của bệnh viện.
- Patient token được hash trước khi xuất khỏi tầng extraction."""),
    code("""from pathlib import Path
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from IPython.display import display, Markdown

REPO_ROOT = Path.cwd()
if REPO_ROOT.name == 'notebooks': REPO_ROOT = REPO_ROOT.parents[1]
elif REPO_ROOT.name == 'analytics': REPO_ROOT = REPO_ROOT.parent
sys.path.insert(0, str(REPO_ROOT))

from analytics.src.extract import load_tasks
from analytics.src.metrics import prepare_tasks, kpis, journey_summary
from analytics.src.data_quality import profile_tasks

FIGURES = REPO_ROOT / 'analytics' / 'reports' / 'figures'
OUTPUTS = REPO_ROOT / 'analytics' / 'outputs'
FIGURES.mkdir(parents=True, exist_ok=True); OUTPUTS.mkdir(parents=True, exist_ok=True)
sns.set_theme(style='whitegrid')
raw, source = load_tasks(prefer_live=True)
tasks = prepare_tasks(raw)
display(Markdown(f'**Source:** `{source}`  \\n+**Rows:** {len(tasks):,} · **Columns:** {len(tasks.columns):,}'))"""),
    markdown("## Data — schema, grain và chất lượng"),
    code("""dictionary = pd.DataFrame({
    'column': tasks.columns,
    'dtype': [str(tasks[c].dtype) for c in tasks.columns],
    'missing': [int(tasks[c].isna().sum()) for c in tasks.columns],
    'missing_rate': [float(tasks[c].isna().mean()) for c in tasks.columns],
    'grain_or_meaning': ['task-level field; see Prisma schema and metrics.yml' for _ in tasks.columns],
})
display(dictionary)
dictionary.to_csv(OUTPUTS / 'data_dictionary.csv', index=False)"""),
    code("""quality_checks, quality_summary = profile_tasks(raw)
display(quality_checks)
quality_checks.to_csv(OUTPUTS / 'data_quality_checks.csv', index=False)
display(Markdown(f\"**Business takeaway.** {quality_summary['failed_checks']} / {quality_summary['quality_checks']} checks có failure; ưu tiên các lỗi critical/high trước khi dùng dashboard để ra quyết định.\"))"""),
    markdown("## Results — phân phối wait time và SLA"),
    code("""waits = tasks['operational_wait_minutes'].dropna()
summary = waits.describe(percentiles=[.5,.8,.9,.95]).to_frame('minutes')
display(summary)
fig, ax = plt.subplots(figsize=(10,4.5))
sns.histplot(waits, bins=min(30, max(5, int(np.sqrt(len(waits))))), ax=ax, color='#1677A6')
ax.set(title='Operational wait time distribution', xlabel='Minutes', ylabel='Tasks')
fig.tight_layout(); fig.savefig(FIGURES / 'wait_distribution.png', dpi=160); plt.show()
display(Markdown(f\"**Business takeaway.** Median là **{waits.median():.1f} phút**, P80 **{waits.quantile(.8):.1f} phút**, P90 **{waits.quantile(.9):.1f} phút**. P80/P90 cần được theo dõi thay vì chỉ dùng average vì wait time có đuôi dài.\"))"""),
    code("""segments = [c for c in ['room_name','queue_id','service_type','event_hour','clinical_priority'] if c in tasks]
for dimension in segments:
    grouped = tasks.groupby(dimension, dropna=False).agg(tasks=('task_id','nunique'), median_wait=('operational_wait_minutes','median'), p80_wait=('operational_wait_minutes',lambda s:s.quantile(.8)), sla_breach_rate=('sla_breach','mean')).reset_index().sort_values('p80_wait', ascending=False)
    display(Markdown(f'### Wait time theo {dimension}'))
    display(grouped.head(20))
    grouped.to_csv(OUTPUTS / f'wait_by_{dimension}.csv', index=False)
display(Markdown('**Business takeaway.** Các segment có P80 cao đồng thời volume lớn là ứng viên bottleneck; segment mẫu nhỏ cần được xem là tín hiệu điều tra, không phải kết luận vận hành.'))"""),
    markdown("## No-show, queue pressure và trạng thái resource"),
    code("""no_show = tasks.get('no_show', pd.Series(False, index=tasks.index)).fillna(False).astype(bool).mean()
sla_rate = tasks.loc[tasks['operational_wait_minutes'].notna(), 'sla_breach'].mean()
display(pd.DataFrame({'metric':['No-show rate','SLA breach rate'], 'value':[no_show, sla_rate]}))
relationship_cols = [c for c in ['queue_length','arrival_rate_15m','avg_service_30m','operational_wait_minutes'] if c in tasks]
display(tasks[relationship_cols].corr(numeric_only=True))
if {'queue_length','operational_wait_minutes'}.issubset(tasks):
    plot_data = tasks.dropna(subset=['queue_length','operational_wait_minutes'])
    if len(plot_data) >= 8:
        fig, ax = plt.subplots(figsize=(8,4.5)); sns.scatterplot(data=plot_data, x='queue_length', y='operational_wait_minutes', hue='resource_failure' if 'resource_failure' in plot_data else None, ax=ax, palette=['#1677A6','#E58245']); fig.tight_layout(); fig.savefig(FIGURES/'queue_vs_wait.png', dpi=160); plt.show()
display(Markdown(f'**Business takeaway.** No-show hiện là **{no_show:.1%}**, SLA breach **{sla_rate:.1%}**. Quan hệ queue/resource và wait chỉ là association; cần simulation hoặc thử nghiệm vận hành để kết luận tác động.'))"""),
    markdown("## Patient journey A → B → quay lại A"),
    code("""journeys = journey_summary(tasks)
display(journeys.describe(include='all'))
step_summary = tasks.groupby('task_type', dropna=False).agg(tasks=('task_id','nunique'), median_wait=('operational_wait_minutes','median'), median_service=('service_duration_minutes','median'), median_result_turnaround=('result_turnaround_minutes','median')).reset_index()
display(step_summary)
step_summary.to_csv(OUTPUTS/'journey_step_summary.csv', index=False)
journeys.to_csv(OUTPUTS/'journey_summary.csv', index=False)
bottleneck = step_summary.sort_values('median_wait', ascending=False).iloc[0]
display(Markdown(f\"**Business takeaway.** Bước có median operational wait cao nhất là **{bottleneck['task_type']}** ({bottleneck['median_wait']:.1f} phút). Có **{int(journeys['has_a_b_return'].sum())}** journey đủ A → B → return trong dữ liệu hiện tại.\"))"""),
    markdown("## Bottleneck synthesis"),
    code("""room_col = 'room_name' if 'room_name' in tasks and tasks['room_name'].notna().any() else 'queue_id'
bottlenecks = tasks.groupby(room_col, dropna=False).agg(tasks=('task_id','nunique'), median_wait=('operational_wait_minutes','median'), p90_wait=('operational_wait_minutes',lambda s:s.quantile(.9)), sla_breach_rate=('sla_breach','mean'), max_queue=('queue_length','max')).reset_index()
bottlenecks['bottleneck_score'] = bottlenecks['p90_wait'].rank(pct=True) + bottlenecks['sla_breach_rate'].rank(pct=True) + bottlenecks['tasks'].rank(pct=True)
bottlenecks = bottlenecks.sort_values('bottleneck_score', ascending=False)
display(bottlenecks)
bottlenecks.to_csv(OUTPUTS/'bottleneck_ranking.csv', index=False)
display(Markdown('**Business takeaway.** Bottleneck score kết hợp tail wait, breach và volume để ưu tiên điều tra; không dùng score này như quyết định phân bổ nguồn lực tự động.'))"""),
    markdown("""## Takeaways

1. Dùng P80/P90 cùng SLA breach để quản trị trải nghiệm đuôi dài.
2. Tách wait tại phòng dịch vụ và wait quay lại review; `RESULT_PENDING` không nên chiếm hard queue.
3. Ưu tiên bottleneck có đồng thời volume, P90 và breach cao.
4. Dữ liệu seeded/synthetic phù hợp demo pipeline; cần timestamp và resource-event thực tế để đánh giá tác động thật."""),
]

notebook = nbf.v4.new_notebook(cells=cells, metadata={"kernelspec":{"display_name":"Python 3","language":"python","name":"python3"},"language_info":{"name":"python","version":"3.12"}})
TARGET.parent.mkdir(parents=True, exist_ok=True)
nbf.write(notebook, TARGET)
print(TARGET)
