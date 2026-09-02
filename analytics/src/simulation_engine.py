"""
MedFlow Hospital Patient Journey Simulation Engine
Discrete-Event & Monte Carlo Queue Simulation for What-If Scenario Analysis
"""

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np


@dataclass
class SimulationConfig:
    num_patients: int = 200
    sim_duration_minutes: float = 480.0  # 8 hours
    arrival_rate_per_hour: float = 25.0
    initial_consult_rooms: int = 4
    diagnostic_rooms: int = 2
    return_review_rooms: int = 4
    consult_duration_mean: float = 12.0
    consult_duration_std: float = 3.0
    diagnostic_duration_mean: float = 15.0
    diagnostic_duration_std: float = 4.0
    return_review_duration_mean: float = 8.0
    return_review_duration_std: float = 2.0
    diagnostic_probability: float = 0.45  # Prob of needing X-ray/Ultrasound
    priority_emergency_prob: float = 0.05
    priority_urgent_prob: float = 0.15
    seed: int = 42


@dataclass
class SimulatedPatient:
    patient_id: str
    arrival_time: float
    priority: str  # EMERGENCY, URGENT, NORMAL
    needs_diagnostic: bool
    
    # Step A: Initial Consult
    consult_wait_time: float = 0.0
    consult_service_time: float = 0.0
    consult_end_time: float = 0.0
    
    # Step B: Diagnostic Service (if applicable)
    diagnostic_wait_time: float = 0.0
    diagnostic_service_time: float = 0.0
    diagnostic_end_time: float = 0.0
    
    # Step A': Return Review (if applicable)
    return_wait_time: float = 0.0
    return_service_time: float = 0.0
    return_end_time: float = 0.0
    
    # Total
    total_wait_time: float = 0.0
    total_length_of_stay: float = 0.0
    sla_breached: bool = False


class MedFlowSimulation:
    def __init__(self, config: SimulationConfig):
        self.config = config
        random.seed(config.seed)
        np.random.seed(config.seed)
        self.patients: List[SimulatedPatient] = []
        self.results_df: Optional[pd.DataFrame] = None
        
    def generate_patients(self) -> List[SimulatedPatient]:
        patients = []
        inter_arrival_mean = 60.0 / self.config.arrival_rate_per_hour
        current_time = 0.0
        
        for i in range(self.config.num_patients):
            # Non-homogeneous Poisson Process (higher arrivals around peak hour 2-3)
            peak_multiplier = 1.0 + 0.8 * math.exp(-((current_time / 60.0 - 2.5) ** 2) / 2.0)
            adjusted_rate = inter_arrival_mean / peak_multiplier
            inter_arrival = random.expovariate(1.0 / adjusted_rate)
            current_time += inter_arrival
            
            if current_time > self.config.sim_duration_minutes:
                break
                
            rand_val = random.random()
            if rand_val < self.config.priority_emergency_prob:
                priority = 'EMERGENCY'
            elif rand_val < (self.config.priority_emergency_prob + self.config.priority_urgent_prob):
                priority = 'URGENT'
            else:
                priority = 'NORMAL'
                
            needs_diagnostic = random.random() < self.config.diagnostic_probability
            
            patients.append(SimulatedPatient(
                patient_id=f"SIM_PT_{i+1:04d}",
                arrival_time=current_time,
                priority=priority,
                needs_diagnostic=needs_diagnostic,
            ))
            
        return patients

    def run(self) -> pd.DataFrame:
        raw_patients = self.generate_patients()
        
        # Priority sort key helper for priority queues (EMERGENCY -> 0, URGENT -> 1, NORMAL -> 2)
        priority_weight = {'EMERGENCY': 0, 'URGENT': 1, 'NORMAL': 2}
        
        # Server availability trackers: list of timestamps when each room becomes free
        consult_servers = [0.0] * self.config.initial_consult_rooms
        diag_servers = [0.0] * self.config.diagnostic_rooms
        return_servers = [0.0] * self.config.return_review_rooms
        
        # We simulate chronologically with multi-step priority queues
        for p in raw_patients:
            # 1. Step A: Initial Consult
            # Pick the earliest available consult server
            earliest_server_idx = int(np.argmin(consult_servers))
            earliest_free_time = consult_servers[earliest_server_idx]
            
            # Start time is max(arrival, server_free_time)
            service_start = max(p.arrival_time, earliest_free_time)
            p.consult_wait_time = max(0.0, service_start - p.arrival_time)
            
            # Duration sampled from log-normal or bounded normal
            p.consult_service_time = max(3.0, np.random.normal(self.config.consult_duration_mean, self.config.consult_duration_std))
            p.consult_end_time = service_start + p.consult_service_time
            consult_servers[earliest_server_idx] = p.consult_end_time
            
            # 2. Step B: Diagnostic (if required)
            if p.needs_diagnostic:
                transit_time = np.random.uniform(2.0, 5.0)  # Walking to radiology
                diag_arrival = p.consult_end_time + transit_time
                
                earliest_diag_idx = int(np.argmin(diag_servers))
                earliest_diag_free = diag_servers[earliest_diag_idx]
                
                diag_start = max(diag_arrival, earliest_diag_free)
                p.diagnostic_wait_time = max(0.0, diag_start - diag_arrival)
                p.diagnostic_service_time = max(5.0, np.random.normal(self.config.diagnostic_duration_mean, self.config.diagnostic_duration_std))
                p.diagnostic_end_time = diag_start + p.diagnostic_service_time
                diag_servers[earliest_diag_idx] = p.diagnostic_end_time
                
                # 3. Step A': Return Review
                return_transit = np.random.uniform(2.0, 4.0)
                return_arrival = p.diagnostic_end_time + return_transit
                
                earliest_return_idx = int(np.argmin(return_servers))
                earliest_return_free = return_servers[earliest_return_idx]
                
                return_start = max(return_arrival, earliest_return_free)
                p.return_wait_time = max(0.0, return_start - return_arrival)
                p.return_service_time = max(2.0, np.random.normal(self.config.return_review_duration_mean, self.config.return_review_duration_std))
                p.return_end_time = return_start + p.return_service_time
                return_servers[earliest_return_idx] = p.return_end_time
                
                # Totals
                p.total_wait_time = p.consult_wait_time + p.diagnostic_wait_time + p.return_wait_time
                p.total_length_of_stay = p.return_end_time - p.arrival_time
            else:
                p.total_wait_time = p.consult_wait_time
                p.total_length_of_stay = p.consult_end_time - p.arrival_time
                
            # SLA breach definition (e.g. consult wait > 30 min or total wait > 60 min)
            p.sla_breached = (p.consult_wait_time > 30.0) or (p.total_wait_time > 60.0)
            self.patients.append(p)
            
        data = [
            {
                'patient_id': p.patient_id,
                'arrival_time': p.arrival_time,
                'priority': p.priority,
                'needs_diagnostic': p.needs_diagnostic,
                'consult_wait_time': p.consult_wait_time,
                'consult_service_time': p.consult_service_time,
                'consult_end_time': p.consult_end_time,
                'diagnostic_wait_time': p.diagnostic_wait_time,
                'diagnostic_service_time': p.diagnostic_service_time,
                'diagnostic_end_time': p.diagnostic_end_time,
                'return_wait_time': p.return_wait_time,
                'return_service_time': p.return_service_time,
                'return_end_time': p.return_end_time,
                'total_wait_time': p.total_wait_time,
                'total_length_of_stay': p.total_length_of_stay,
                'sla_breached': p.sla_breached,
            }
            for p in self.patients
        ]
        self.results_df = pd.DataFrame(data)
        return self.results_df

    def get_summary_metrics(self) -> Dict[str, float]:
        if self.results_df is None or self.results_df.empty:
            return {}
            
        df = self.results_df
        return {
            'total_patients': len(df),
            'avg_wait_time_consult': round(float(df['consult_wait_time'].mean()), 2),
            'p90_wait_time_consult': round(float(df['consult_wait_time'].quantile(0.90)), 2),
            'avg_wait_time_diagnostic': round(float(df[df['needs_diagnostic']]['diagnostic_wait_time'].mean()), 2) if df['needs_diagnostic'].any() else 0.0,
            'avg_wait_time_return': round(float(df[df['needs_diagnostic']]['return_wait_time'].mean()), 2) if df['needs_diagnostic'].any() else 0.0,
            'avg_total_wait_time': round(float(df['total_wait_time'].mean()), 2),
            'p90_total_wait_time': round(float(df['total_wait_time'].quantile(0.90)), 2),
            'avg_length_of_stay': round(float(df['total_length_of_stay'].mean()), 2),
            'sla_breach_rate_pct': round(float(df['sla_breached'].mean() * 100), 2),
        }


def run_scenario_comparison(base_config: SimulationConfig, scenarios: Dict[str, Dict[str, any]]) -> pd.DataFrame:
    """Run multiple what-if simulation scenarios and return comparative DataFrame"""
    summary_rows = []
    
    # Baseline
    base_sim = MedFlowSimulation(base_config)
    base_sim.run()
    base_metrics = base_sim.get_summary_metrics()
    base_metrics['scenario_name'] = '0. Baseline (Hiện trạng)'
    summary_rows.append(base_metrics)
    
    # Scenarios
    for name, overrides in scenarios.items():
        # Create shallow copy dict of config
        cfg_dict = base_config.__dict__.copy()
        cfg_dict.update(overrides)
        scenario_cfg = SimulationConfig(**cfg_dict)
        
        sim = MedFlowSimulation(scenario_cfg)
        sim.run()
        metrics = sim.get_summary_metrics()
        metrics['scenario_name'] = name
        summary_rows.append(metrics)
        
    res = pd.DataFrame(summary_rows)
    # Reorder columns
    cols = ['scenario_name', 'total_patients', 'avg_wait_time_consult', 'p90_wait_time_consult', 'avg_total_wait_time', 'p90_total_wait_time', 'avg_length_of_stay', 'sla_breach_rate_pct']
    return res[[c for c in cols if c in res.columns]]


if __name__ == '__main__':
    cfg = SimulationConfig()
    sim = MedFlowSimulation(cfg)
    df = sim.run()
    metrics = sim.get_summary_metrics()
    print("Simulation completed:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
