-- Descriptive association only; this does not establish causal impact.
WITH waits AS (
  SELECT resource_failure,
         EXTRACT(EPOCH FROM (service_start - GREATEST(ready_at, arrival_time))) / 60.0 AS wait_minutes
  FROM patient_journey_tasks WHERE service_start IS NOT NULL AND COALESCE(ready_at, arrival_time) IS NOT NULL
)
SELECT resource_failure, count(*) AS tasks, round(avg(wait_minutes)::numeric, 2) AS average_wait,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY wait_minutes) AS median_wait,
       percentile_cont(0.90) WITHIN GROUP (ORDER BY wait_minutes) AS p90_wait
FROM waits WHERE wait_minutes >= 0 GROUP BY resource_failure ORDER BY resource_failure;

