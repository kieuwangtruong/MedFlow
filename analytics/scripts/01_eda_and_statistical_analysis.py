"""
EDA & Statistical Analysis Script
Comprehensive Exploratory Data Analysis, Distribution Fitting, and Statistical Testing
"""

import os
import sys
import json
from pathlib import Path
import pandas as pd
import numpy as np

# Ensure project analytics root is in path
analytics_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(analytics_root))

from src.extract import extract_all_entities, get_storage_path
from src.datamart import build_gold_datamart
from src.metrics import calculate_percentiles, compute_specialty_benchmarks, compute_aba_breakdown


def run_statistical_analysis(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    print("=" * 60)
    print("MedFlow EDA & Statistical Analysis Pipeline")
    print("=" * 60)

    # 1. Ingest / Build Data Mart
    print("\n[Step 1] Loading Silver & Gold Data Mart...")
    dm = build_gold_datamart()
    fact_task = dm['fact_task_execution']
    fact_journey = dm['fact_patient_journey']
    dim_patient = dm['dim_patient']
    dim_room = dm['dim_clinic_room']

    # 2. Descriptive Statistics on Durations & Wait Times
    print("\n[Step 2] Computing Descriptive & Percentile Metrics...")
    durations = fact_task['duration_minutes'].dropna()
    wait_times = fact_task['wait_time_minutes'].dropna()

    stats_summary = {
        'duration_metrics': calculate_percentiles(durations),
        'wait_time_metrics': calculate_percentiles(wait_times),
        'total_tasks_analyzed': len(fact_task),
        'total_journeys_analyzed': len(fact_journey),
        'completed_tasks_count': int((fact_task['status'] == 'COMPLETED').sum()),
    }

    # 3. Specialty Benchmark Breakdown
    print("\n[Step 3] Computing Specialty Performance Benchmarks...")
    specialty_benchmarks = compute_specialty_benchmarks(fact_task)

    # 4. A -> B -> A' Breakdown
    print("\n[Step 4] Analyzing Consultation -> Diagnostics -> Return Journey...")
    aba_summary = compute_aba_breakdown(fact_task)

    # 5. Correlation Analysis
    print("\n[Step 5] Correlation Matrix on Queue & Wait Parameters...")
    numeric_cols = [
        'wait_time_minutes', 'duration_minutes', 'queue_length',
        'arrival_rate_15m', 'avg_service_30m', 'actual_wait_time',
        'active_service_duration', 'interruption_duration'
    ]
    available_cols = [c for c in numeric_cols if c in fact_task.columns and fact_task[c].notna().sum() > 5]
    if available_cols:
        corr_matrix = fact_task[available_cols].corr()
        corr_matrix.to_csv(output_dir / 'correlation_matrix.csv')
        print(f"  -> Exported correlation matrix ({len(available_cols)} features)")
    else:
        corr_matrix = pd.DataFrame()

    # 6. SLA Breach Risk Factor Analysis
    print("\n[Step 6] Analyzing SLA Violation Risk Factors...")
    sla_threshold = 30.0  # 30 mins
    fact_task['is_sla_breached'] = fact_task['wait_time_minutes'] > sla_threshold
    breach_by_priority = fact_task.groupby('clinical_priority')['is_sla_breached'].agg(['count', 'mean']).rename(columns={'mean': 'breach_rate'})
    breach_by_priority.to_csv(output_dir / 'sla_breach_by_priority.csv')

    # 7. Compile Final EDA Report JSON
    eda_report = {
        'summary_statistics': stats_summary,
        'specialty_benchmarks': specialty_benchmarks.to_dict(orient='records') if not specialty_benchmarks.empty else [],
        'aba_breakdown': aba_summary,
        'sla_breach_summary': breach_by_priority.reset_index().to_dict(orient='records') if not breach_by_priority.empty else [],
    }

    report_path = output_dir / 'eda_statistical_report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(eda_report, f, indent=2, ensure_ascii=False)

    print(f"\n[Success] Statistical analysis report generated at:\n  -> {report_path}")
    print("=" * 60)


if __name__ == '__main__':
    out = analytics_root / 'reports'
    run_statistical_analysis(out)
