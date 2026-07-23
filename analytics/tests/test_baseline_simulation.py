from analytics.src.baseline_simulation import SCENARIOS, compare_baselines, generate_workload, run_scenario


def test_same_workload_completed_in_all_scenarios():
    workload = generate_workload(7, 40)
    for scenario in SCENARIOS:
        result = run_scenario(workload, scenario)
        assert len(result) == len(workload)
        assert (result["wait_minutes"] >= 0).all()


def test_comparison_has_required_metrics():
    comparison, impacts = compare_baselines(runs=2, patients=30)
    assert set(comparison["scenario"]) == {scenario.name for scenario in SCENARIOS}
    assert {"median_wait", "p80_wait", "p90_wait", "sla_breach_rate", "throughput_per_hour"}.issubset(comparison.columns)
    assert "affected_normal_patients" in impacts.columns
