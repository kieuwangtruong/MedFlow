-- Observational comparison; simulation in baseline_simulation.py supplies the controlled counterfactual.
WITH waits AS (
  SELECT emergency_insertion,
         EXTRACT(EPOCH FROM (service_start - GREATEST(ready_at, arrival_time))) / 60.0 AS wait_minutes
  FROM patient_journey_tasks
  WHERE clinical_priority::text = 'NORMAL' AND service_start IS NOT NULL AND COALESCE(ready_at, arrival_time) IS NOT NULL
), grouped AS (
  SELECT emergency_insertion, count(*) AS tasks, avg(wait_minutes) AS avg_wait,
         percentile_cont(0.50) WITHIN GROUP (ORDER BY wait_minutes) AS median_wait
  FROM waits WHERE wait_minutes >= 0 GROUP BY emergency_insertion
)
SELECT *, avg_wait - max(avg_wait) FILTER (WHERE emergency_insertion = false) OVER () AS average_added_wait_vs_no_insertion
FROM grouped ORDER BY emergency_insertion;

