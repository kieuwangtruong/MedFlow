from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from analytics.src.extract import load_tasks
from analytics.src.metrics import (
    bottleneck_3step_analysis,
    prepare_tasks,
    sla_performance_by_priority,
    specialty_performance_breakdown,
    statistical_distribution_summary,
)

# Style setup for enterprise publication aesthetic
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams.update({
    "font.sans-serif": "Arial",
    "axes.edgecolor": "#D1D5DB",
    "axes.linewidth": 0.8,
    "figure.autolayout": True,
})

REPO_ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = REPO_ROOT / "analytics" / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"


def generate_eda_figures(df: pd.DataFrame) -> None:
    """Generate professional analytical charts for DA/DE portfolio reports."""
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    frame = prepare_tasks(df)

    # 1. Operational Wait Time Distribution with P50, P80, P90 markers
    waits = frame["operational_wait_minutes"].dropna()
    if not waits.empty:
        plt.figure(figsize=(9, 5), dpi=300)
        ax = sns.histplot(waits, kde=True, color="#1677A6", bins=15, alpha=0.6)
        p50 = float(waits.median())
        p80 = float(waits.quantile(0.80))
        p90 = float(waits.quantile(0.90))
        
        plt.axvline(p50, color="#10B981", linestyle="--", linewidth=2, label=f"Median (P50): {p50:.1f}m")
        plt.axvline(p80, color="#F59E0B", linestyle="--", linewidth=2, label=f"P80: {p80:.1f}m")
        plt.axvline(p90, color="#EF4444", linestyle="--", linewidth=2, label=f"P90: {p90:.1f}m")
        
        plt.title("Phân phối Thời gian Chờ Vận hành (Operational Wait Time Distribution)", fontsize=13, fontweight="bold", pad=12)
        plt.xlabel("Thời gian chờ (phút)", fontsize=11)
        plt.ylabel("Số lượng lượt khám (Frequency)", fontsize=11)
        plt.legend(frameon=True, facecolor="white", edgecolor="#E5E7EB")
        plt.tight_layout()
        plt.savefig(FIGURES_DIR / "wait_time_distribution.png")
        plt.close()

    # 2. Specialty Performance & P80 Wait Breakdown
    spec_df = specialty_performance_breakdown(frame)
    if not spec_df.empty:
        plt.figure(figsize=(10, 6), dpi=300)
        spec_sorted = spec_df.sort_values("wait_p80", ascending=True)
        colors = ["#EF4444" if b > 0.3 else "#1677A6" for b in spec_sorted["sla_breach_rate"]]
        
        bars = plt.barh(spec_sorted["specialty_or_service"], spec_sorted["wait_p80"], color=colors, height=0.6)
        plt.title("Thời gian Chờ Phân vị P80 theo Chuyên khoa Lâm sàng (P80 Wait by Specialty)", fontsize=13, fontweight="bold", pad=12)
        plt.xlabel("Thời gian chờ P80 (phút)", fontsize=11)
        plt.ylabel("Chuyên khoa / Dịch vụ", fontsize=11)
        
        for bar in bars:
            w = bar.get_width()
            if not np.isnan(w):
                plt.text(w + 0.3, bar.get_y() + 0.15, f"{w:.1f}m", va="center", fontsize=9, fontweight="bold")
                
        plt.tight_layout()
        plt.savefig(FIGURES_DIR / "specialty_p80_comparison.png")
        plt.close()

    # 3. SLA Compliance by Clinical Priority
    sla_df = sla_performance_by_priority(frame)
    if not sla_df.empty:
        plt.figure(figsize=(8, 4.5), dpi=300)
        x = np.arange(len(sla_df))
        width = 0.35
        
        plt.bar(x - width/2, sla_df["sla_compliance_rate"] * 100, width, label="Đạt chuẩn SLA (%)", color="#10B981")
        plt.bar(x + width/2, sla_df["sla_breach_rate"] * 100, width, label="Vi phạm SLA (%)", color="#EF4444")
        
        plt.xticks(x, sla_df["clinical_priority"])
        plt.title("Tỷ lệ Tuân thủ và Vi phạm SLA theo Mức độ Ưu tiên Y khoa", fontsize=13, fontweight="bold", pad=12)
        plt.ylabel("Tỷ lệ phần trăm (%)", fontsize=11)
        plt.ylim(0, 115)
        plt.legend(frameon=True, facecolor="white", edgecolor="#E5E7EB")
        plt.tight_layout()
        plt.savefig(FIGURES_DIR / "sla_compliance_matrix.png")
        plt.close()

    # 4. 3-Step Journey Bottleneck Analysis (Initial -> Diagnostic -> Return Review)
    if "task_type" in frame:
        plt.figure(figsize=(8, 5), dpi=300)
        step_order = ["INITIAL_CONSULT", "DIAGNOSTIC_SERVICE", "RETURN_REVIEW"]
        valid_steps = frame[frame["task_type"].isin(step_order)]
        
        sns.boxplot(
            data=valid_steps,
            x="task_type",
            y="operational_wait_minutes",
            hue="task_type",
            legend=False,
            order=step_order,
            palette=["#3B82F6", "#F59E0B", "#8B5CF6"],
            width=0.4,
        )
        plt.title("Phân tích Nút thắt Cổ chai Quy trình Khám 3 Bước (A → B → A')", fontsize=13, fontweight="bold", pad=12)
        plt.xlabel("Giai đoạn hành trình", fontsize=11)
        plt.ylabel("Thời gian chờ vận hành (phút)", fontsize=11)
        plt.tight_layout()
        plt.savefig(FIGURES_DIR / "bottleneck_3step_breakdown.png")
        plt.close()


def df_to_markdown(df: pd.DataFrame) -> str:
    """Format DataFrame as markdown table without needing tabulate dependency."""
    if df.empty:
        return "*(Không có dữ liệu)*"
    headers = [str(c) for c in df.columns]
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for _, row in df.iterrows():
        row_vals = [f"{v:.2f}" if isinstance(v, float) else str(v) for v in row]
        lines.append("| " + " | ".join(row_vals) + " |")
    return "\n".join(lines)


def run_full_eda_report() -> None:
    """Execute complete automated statistical EDA and generate report artifact."""
    raw, source = load_tasks()
    frame = prepare_tasks(raw)
    
    generate_eda_figures(raw)
    
    # Statistical summaries
    wait_stats = statistical_distribution_summary(frame["operational_wait_minutes"])
    service_stats = statistical_distribution_summary(frame["service_duration_minutes"])
    spec_summary = specialty_performance_breakdown(frame)
    sla_summary = sla_performance_by_priority(frame)
    bottlenecks = bottleneck_3step_analysis(frame)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    spec_summary.to_csv(REPORTS_DIR / "specialty_performance.csv", index=False)
    sla_summary.to_csv(REPORTS_DIR / "sla_performance.csv", index=False)

    md_report = f"""# Báo Cáo Phân Tích Khám Phá Dữ Liệu Y Tế (Healthcare Exploratory Data Analysis)

> **Tự động sinh bởi:** MedFlow Advanced Statistical Engine  
> **Nguồn dữ liệu:** {source}  
> **Tổng số bản ghi:** {len(frame)} tasks, {frame.get('journey_id', pd.Series()).nunique()} journeys  

---

## 1. Thống Kê Phân Phối Thời Gian Chờ & Thời Gian Khám (Statistical Distribution Moments)

| Chỉ số Thống kê | Thời gian Chờ Vận hành (Phút) | Thời gian Khám/Thủ thuật (Phút) |
| :--- | :--- | :--- |
| **Kích thước mẫu (Count)** | {wait_stats['count']} | {service_stats['count']} |
| **Trung bình (Mean $\\mu$)** | {wait_stats['mean']} | {service_stats['mean']} |
| **Độ lệch chuẩn (Std $\\sigma$)** | {wait_stats['std']} | {service_stats['std']} |
| **Trung vị (Median / P50)** | {wait_stats['median']} | {service_stats['median']} |
| **Phân vị 25% (P25 / Q1)** | {wait_stats['p25']} | {service_stats['p25']} |
| **Phân vị 75% (P75 / Q3)** | {wait_stats['p75']} | {service_stats['p75']} |
| **Khoảng phân vị (IQR)** | {wait_stats['iqr']} | {service_stats['iqr']} |
| **Phân vị 80% (P80)** | {wait_stats['p80']} | {service_stats['p80']} |
| **Phân vị 90% (P90)** | {wait_stats['p90']} | {service_stats['p90']} |
| **Hệ số Bất đối xứng (Skewness)** | {wait_stats['skewness']} | {service_stats['skewness']} |
| **Độ nhọn phân phối (Kurtosis)** | {wait_stats['kurtosis']} | {service_stats['kurtosis']} |
| **Hệ số Biến thiên (CV)** | {wait_stats['cv']} | {service_stats['cv']} |

---

## 2. Hiệu Suất Theo Chuyên Khoa Lâm Sàng (Specialty Performance Breakdown)

{df_to_markdown(spec_summary)}

---

## 3. Tuân Thủ Chuẩn SLA Theo Mức Độ Ưu Tiên Y Khoa

{df_to_markdown(sla_summary)}

---

## 4. Phân Tích Nút Thắt Cổ Chai Hành Trình 3 Bước ($A \\to B \\to A'$)

* **Giai đoạn 1 (Khám ban đầu - INITIAL_CONSULT):** Median Wait = `{bottlenecks['step_metrics']['INITIAL_CONSULT']['median_wait']}` phút, P80 = `{bottlenecks['step_metrics']['INITIAL_CONSULT']['p80_wait']}` phút.
* **Giai đoạn 2 (Cận lâm sàng - DIAGNOSTIC_SERVICE):** Median Wait = `{bottlenecks['step_metrics']['DIAGNOSTIC_SERVICE']['median_wait']}` phút, P80 = `{bottlenecks['step_metrics']['DIAGNOSTIC_SERVICE']['p80_wait']}` phút.
* **Giai đoạn 3 (Tái khám kết luận - RETURN_REVIEW):** Median Wait = `{bottlenecks['step_metrics']['RETURN_REVIEW']['median_wait']}` phút, P80 = `{bottlenecks['step_metrics']['RETURN_REVIEW']['p80_wait']}` phút.
* **Thời gian Chờ Trả Kết quả Chẩn đoán hình ảnh (Turnaround Time):** Median = `{bottlenecks['result_turnaround_p50']}` phút, P80 = `{bottlenecks['result_turnaround_p80']}` phút, P90 = `{bottlenecks['result_turnaround_p90']}` phút.

---
*Báo cáo xuất bản tự động vào thư mục `analytics/reports/`.*
"""

    (REPORTS_DIR / "eda_statistical_summary.md").write_text(md_report, encoding="utf-8")
    print(f"=== EDA Report & Figures Successfully Generated in {REPORTS_DIR} ===")


if __name__ == "__main__":
    run_full_eda_report()
