import pandas as pd
import pytest

from analytics.src.simulation_engine import SimulationConfig, evaluate_simulation_strategies, generate_synthetic_cohort, simulate_strategy


def test_synthetic_cohort_generation():
    config = SimulationConfig(patients=50, seed=123)
    cohort = generate_synthetic_cohort(config)
    assert len(cohort) == 50
    assert "arrival_time" in cohort.columns
    assert "priority" in cohort.columns
    assert "consult_duration" in cohort.columns
    assert (cohort["arrival_time"].diff().dropna() >= 0).all()


def test_simulation_strategies_comparison():
    config = SimulationConfig(patients=40, consult_rooms=3, imaging_rooms=2, seed=42)
    summary, details = evaluate_simulation_strategies(config)
    
    assert len(summary) == 3
    assert set(summary["Strategy"]) == {
        "Static Round-Robin",
        "Shortest Queue First (SQF)",
        "AI-Driven P80 Balancing",
    }
    assert "Median Wait (min)" in summary.columns
    assert "Wait Reduction Delta W (%)" in summary.columns
    assert len(details) == 40 * 3
