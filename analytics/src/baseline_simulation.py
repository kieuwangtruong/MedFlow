from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Scenario:
    name: str
    priority_enabled: bool
    routing_enabled: bool


SCENARIOS = [
    Scenario("FCFS", False, False),
    Scenario("Priority Queue", True, False),
    Scenario("Queue Engine + Routing", True, True),
]
PRIORITY_RANK = {"EMERGENCY": 0, "URGENT": 1, "NORMAL": 2, "NON_URGENT": 3}
SLA = {"EMERGENCY": 5, "URGENT": 15, "NORMAL": 30, "NON_URGENT": 60}


def generate_workload(seed: int, patients: int = 180) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    arrivals = np.cumsum(rng.exponential(2.0, patients))
    priorities = rng.choice(["NORMAL", "URGENT", "EMERGENCY", "NON_URGENT"], patients, p=[0.72, 0.15, 0.04, 0.09])
    services = rng.choice(["CLINICAL_CONSULT", "XRAY", "ABDOMINAL_ULTRASOUND", "RESULT_REVIEW"], patients, p=[0.38, 0.22, 0.22, 0.18])
    duration = np.maximum(2, rng.lognormal(np.log(10), 0.35, patients))
    return pd.DataFrame({"patient_id": np.arange(patients), "arrival": arrivals, "priority": priorities, "service": services, "duration": duration})


def run_scenario(workload: pd.DataFrame, scenario: Scenario, resources: int = 3) -> pd.DataFrame:
    available = [0.0] * resources
    records = []
    rows = workload.to_dict("records")
    # Priority is evaluated inside a rolling 15-minute arrival window; this keeps
    # the comparison causal in time while allowing urgent work to move forward.
    if scenario.priority_enabled:
        rows.sort(key=lambda row: (int(row["arrival"] // 15), PRIORITY_RANK[row["priority"]], row["arrival"], row["patient_id"]))
    else:
        rows.sort(key=lambda row: (row["arrival"], row["patient_id"]))
    home_resource = {"CLINICAL_CONSULT": 0, "RESULT_REVIEW": 0, "XRAY": 1, "ABDOMINAL_ULTRASOUND": 2}
    compatible = {"CLINICAL_CONSULT": [0], "RESULT_REVIEW": [0], "XRAY": [1, 2], "ABDOMINAL_ULTRASOUND": [1, 2]}
    for chosen in rows:
        candidates = compatible[chosen["service"]] if scenario.routing_enabled else [home_resource[chosen["service"]]]
        resource = min(candidates, key=lambda index: available[index])
        start = max(available[resource], chosen["arrival"])
        finish = start + chosen["duration"]
        available[resource] = finish
        wait = start - chosen["arrival"]
        records.append({**chosen, "scenario": scenario.name, "wait_minutes": wait, "completion_minutes": finish - chosen["arrival"], "sla_breach": wait > SLA[chosen["priority"]]})
    return pd.DataFrame(records)


def summarize(result: pd.DataFrame) -> dict:
    normal = result[result["priority"] == "NORMAL"]["wait_minutes"]
    return {
        "scenario": result["scenario"].iloc[0],
        "median_wait": result["wait_minutes"].median(),
        "p80_wait": result["wait_minutes"].quantile(0.80),
        "p90_wait": result["wait_minutes"].quantile(0.90),
        "sla_breach_rate": result["sla_breach"].mean(),
        "average_journey_completion": result["completion_minutes"].mean(),
        "throughput_per_hour": len(result) / max(1.0, result.eval("arrival + completion_minutes").max() - result["arrival"].min()) * 60,
        "normal_p90_p50_spread": normal.quantile(0.90) - normal.quantile(0.50),
        "normal_wait_cv": normal.std(ddof=0) / normal.mean() if normal.mean() else 0.0,
    }


def compare_baselines(runs: int = 30, patients: int = 180) -> tuple[pd.DataFrame, pd.DataFrame]:
    summaries = []
    emergency_impacts = []
    for seed in range(runs):
        workload = generate_workload(seed, patients)
        without_emergency = workload[workload["priority"] != "EMERGENCY"].copy()
        for scenario in SCENARIOS:
            result = run_scenario(workload, scenario)
            summaries.append({"run": seed, **summarize(result)})
            normal_with = result[result["priority"] == "NORMAL"].set_index("patient_id")["wait_minutes"]
            normal_without = run_scenario(without_emergency, scenario).set_index("patient_id")["wait_minutes"]
            aligned = normal_with.to_frame("with_emergency").join(normal_without.rename("without_emergency"), how="inner")
            delay = aligned["with_emergency"] - aligned["without_emergency"]
            emergency_impacts.append({"run": seed, "scenario": scenario.name, "affected_normal_patients": int((delay > 0).sum()), "average_added_wait": float(delay.clip(lower=0).mean()), "max_added_wait": float(delay.max())})
    raw = pd.DataFrame(summaries)
    aggregate = raw.groupby("scenario", as_index=False).agg(
        median_wait=("median_wait", "mean"), p80_wait=("p80_wait", "mean"), p90_wait=("p90_wait", "mean"),
        sla_breach_rate=("sla_breach_rate", "mean"), average_journey_completion=("average_journey_completion", "mean"),
        throughput_per_hour=("throughput_per_hour", "mean"), normal_p90_p50_spread=("normal_p90_p50_spread", "mean"), normal_wait_cv=("normal_wait_cv", "mean"),
    )
    impacts = pd.DataFrame(emergency_impacts).groupby("scenario", as_index=False).mean(numeric_only=True)
    return aggregate, impacts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=30)
    parser.add_argument("--patients", type=int, default=180)
    parser.add_argument("--output", default=str(Path(__file__).resolve().parents[1] / "outputs"))
    args = parser.parse_args()
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    comparison, impacts = compare_baselines(args.runs, args.patients)
    comparison.to_csv(output / "baseline_comparison.csv", index=False)
    impacts.to_csv(output / "emergency_impact.csv", index=False)
    print(comparison.to_string(index=False))


if __name__ == "__main__":
    main()
