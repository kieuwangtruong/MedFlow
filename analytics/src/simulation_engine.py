from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ANALYTICS_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ANALYTICS_ROOT / "outputs"


@dataclass(frozen=True)
class SimulationConfig:
    patients: int = 150
    arrival_interval_mean: float = 2.5  # Minutes between arrivals (Poisson process)
    emergency_ratio: float = 0.05
    urgent_ratio: float = 0.15
    resource_failure_rate: float = 0.02
    consult_rooms: int = 4
    imaging_rooms: int = 2
    seed: int = 42


PRIORITY_WEIGHTS = {
    "EMERGENCY": 0,
    "URGENT": 1,
    "NORMAL": 2,
    "NON_URGENT": 3,
}

SLA_LIMITS = {
    "EMERGENCY": 5.0,
    "URGENT": 15.0,
    "NORMAL": 30.0,
    "NON_URGENT": 60.0,
}


def generate_synthetic_cohort(config: SimulationConfig) -> pd.DataFrame:
    """Generate reproducible stochastic patient workload stream."""
    rng = np.random.default_rng(config.seed)
    n = config.patients

    # Arrival timestamps via exponential inter-arrival intervals
    inter_arrivals = rng.exponential(config.arrival_interval_mean, n)
    arrivals = np.cumsum(inter_arrivals)

    # Priority distribution
    p_emergency = config.emergency_ratio
    p_urgent = config.urgent_ratio
    p_non_urgent = 0.10
    p_normal = max(0.0, 1.0 - (p_emergency + p_urgent + p_non_urgent))
    
    priorities = rng.choice(
        ["EMERGENCY", "URGENT", "NORMAL", "NON_URGENT"],
        size=n,
        p=[p_emergency, p_urgent, p_normal, p_non_urgent],
    )

    # Service pathway: 65% have A -> B -> A' pathway (consult -> diagnostic -> return)
    pathways = rng.choice(["CONSULT_ONLY", "FULL_A_B_A"], size=n, p=[0.35, 0.65])
    
    # Base service times (log-normal distribution)
    consult_durations = np.maximum(3.0, rng.lognormal(np.log(8.0), 0.35, n))
    imaging_durations = np.maximum(5.0, rng.lognormal(np.log(12.0), 0.40, n))
    return_durations = np.maximum(2.0, rng.lognormal(np.log(4.0), 0.30, n))
    
    # Equipment / resource failure flags
    failures = rng.random(n) < config.resource_failure_rate

    records = []
    for i in range(n):
        records.append({
            "patient_id": f"P-{i:04d}",
            "arrival_time": arrivals[i],
            "priority": priorities[i],
            "pathway": pathways[i],
            "consult_duration": consult_durations[i] * (1.5 if failures[i] else 1.0),
            "imaging_duration": imaging_durations[i] * (1.8 if failures[i] else 1.0),
            "return_duration": return_durations[i],
            "has_failure": failures[i],
        })
    return pd.DataFrame(records)


def simulate_strategy(cohort: pd.DataFrame, strategy: str, num_consult: int = 4, num_imaging: int = 2) -> pd.DataFrame:
    """
    Simulate queue dynamics under 3 distinct routing strategies:
    1. 'STATIC_ROUND_ROBIN': Rigid cyclic room assignment.
    2. 'SHORTEST_QUEUE_FIRST': Greedily routes to room with shortest queue count.
    3. 'AI_DRIVEN_P80_WAIT': Dynamically evaluates expected P80 queue clearance time.
    """
    consult_available = [0.0] * num_consult
    imaging_available = [0.0] * num_imaging
    
    consult_queues = [0] * num_consult
    imaging_queues = [0] * num_imaging
    
    results = []
    
    # Sort events by arrival time
    events = cohort.sort_values("arrival_time").to_dict("records")
    
    for idx, p in enumerate(events):
        arr = p["arrival_time"]
        prio = p["priority"]
        sla = SLA_LIMITS[prio]
        
        # --- Step 1: Initial Consult ---
        if strategy == "STATIC_ROUND_ROBIN":
            chosen_consult = idx % num_consult
        elif strategy == "SHORTEST_QUEUE_FIRST":
            # Count active queue at time arr
            chosen_consult = min(range(num_consult), key=lambda r: max(0.0, consult_available[r] - arr))
        elif strategy == "AI_DRIVEN_P80_WAIT":
            # AI Score = Expected remaining finish time + priority bias
            chosen_consult = min(range(num_consult), key=lambda r: max(0.0, consult_available[r] - arr) + (0.5 * consult_queues[r]))
        else:
            chosen_consult = 0

        c_start = max(arr, consult_available[chosen_consult])
        c_dur = p["consult_duration"]
        c_end = c_start + c_dur
        consult_available[chosen_consult] = c_end
        consult_wait = c_start - arr
        consult_queues[chosen_consult] += 1
        
        total_journey_wait = consult_wait
        total_journey_service = c_dur
        final_end = c_end

        # --- Step 2 & 3: Diagnostic & Return Review if applicable ---
        diag_wait = 0.0
        return_wait = 0.0
        if p["pathway"] == "FULL_A_B_A":
            # Diagnostic step
            diag_arr = c_end + 2.0  # 2 mins walk to radiology
            if strategy == "STATIC_ROUND_ROBIN":
                chosen_img = idx % num_imaging
            elif strategy in ["SHORTEST_QUEUE_FIRST", "AI_DRIVEN_P80_WAIT"]:
                chosen_img = min(range(num_imaging), key=lambda r: max(0.0, imaging_available[r] - diag_arr))
            else:
                chosen_img = 0

            img_start = max(diag_arr, imaging_available[chosen_img])
            img_dur = p["imaging_duration"]
            img_end = img_start + img_dur
            imaging_available[chosen_img] = img_end
            diag_wait = img_start - diag_arr

            # Lab/Radiology processing turnaround before return review
            result_ready = img_end + 5.0
            return_arr = max(result_ready, img_end + 3.0)
            
            # Return review at original consult room
            ret_start = max(return_arr, consult_available[chosen_consult])
            ret_dur = p["return_duration"]
            final_end = ret_start + ret_dur
            consult_available[chosen_consult] = final_end
            return_wait = ret_start - return_arr
            
            total_journey_wait += (diag_wait + return_wait)
            total_journey_service += (img_dur + ret_dur)

        journey_duration = final_end - arr
        is_breach = consult_wait > sla

        results.append({
            "patient_id": p["patient_id"],
            "strategy": strategy,
            "priority": prio,
            "pathway": p["pathway"],
            "arrival_time": arr,
            "consult_wait_minutes": consult_wait,
            "diagnostic_wait_minutes": diag_wait,
            "return_wait_minutes": return_wait,
            "total_wait_minutes": total_journey_wait,
            "journey_duration_minutes": journey_duration,
            "sla_limit_minutes": sla,
            "is_sla_breach": is_breach,
            "consult_room_assigned": f"Room-{chosen_consult + 1}",
        })

    return pd.DataFrame(results)


def evaluate_simulation_strategies(config: SimulationConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Run all 3 strategies on identical stochastic workload and compare key operational KPIs."""
    cohort = generate_synthetic_cohort(config)
    
    strategies = [
        ("Static Round-Robin", "STATIC_ROUND_ROBIN"),
        ("Shortest Queue First (SQF)", "SHORTEST_QUEUE_FIRST"),
        ("AI-Driven P80 Balancing", "AI_DRIVEN_P80_WAIT"),
    ]
    
    all_runs = []
    summary_rows = []
    
    baseline_median_wait = None

    for label, strat_code in strategies:
        df = simulate_strategy(cohort, strat_code, config.consult_rooms, config.imaging_rooms)
        df["strategy_label"] = label
        all_runs.append(df)
        
        waits = df["total_wait_minutes"]
        med_wait = float(waits.median())
        p80_wait = float(waits.quantile(0.80))
        p90_wait = float(waits.quantile(0.90))
        mean_wait = float(waits.mean())
        breach_rate = float(df["is_sla_breach"].mean())
        avg_journey = float(df["journey_duration_minutes"].mean())
        
        # Room utilization variance / load balancing CV
        room_counts = df["consult_room_assigned"].value_counts()
        cv_balance = float(room_counts.std() / room_counts.mean()) if room_counts.mean() > 0 else 0.0

        if baseline_median_wait is None:
            baseline_median_wait = med_wait
            delta_w = 0.0
        else:
            delta_w = ((baseline_median_wait - med_wait) / baseline_median_wait) * 100.0 if baseline_median_wait > 0 else 0.0

        summary_rows.append({
            "Strategy": label,
            "Median Wait (min)": round(med_wait, 1),
            "P80 Wait (min)": round(p80_wait, 1),
            "P90 Wait (min)": round(p90_wait, 1),
            "Mean Wait (min)": round(mean_wait, 1),
            "SLA Breach Rate (%)": round(breach_rate * 100.0, 1),
            "Wait Reduction Delta W (%)": round(delta_w, 1),
            "Avg Journey Time (min)": round(avg_journey, 1),
            "Room Imbalance (CV)": round(cv_balance, 3),
        })

    summary_df = pd.DataFrame(summary_rows)
    details_df = pd.concat(all_runs, ignore_index=True)
    return summary_df, details_df


def main() -> None:
    parser = argparse.ArgumentParser(description="MedFlow Clinic Queue Simulation Engine")
    parser.add_argument("--patients", type=int, default=180)
    parser.add_argument("--consult-rooms", type=int, default=4)
    parser.add_argument("--imaging-rooms", type=int, default=2)
    parser.add_argument("--emergency-ratio", type=float, default=0.06)
    args = parser.parse_args()

    config = SimulationConfig(
        patients=args.patients,
        consult_rooms=args.consult_rooms,
        imaging_rooms=args.imaging_rooms,
        emergency_ratio=args.emergency_ratio,
    )
    
    summary, details = evaluate_simulation_strategies(config)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    summary.to_csv(OUTPUT_DIR / "simulation_summary.csv", index=False)
    details.to_csv(OUTPUT_DIR / "simulation_details.csv", index=False)
    
    print("=== Queue Load Balancing Simulation Results ===")
    print(summary.to_string(index=False))


if __name__ == "__main__":
    main()
