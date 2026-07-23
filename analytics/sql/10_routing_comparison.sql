-- Uses scheduling_mode as the available operational proxy; controlled algorithm comparison is in baseline_simulation.py.
WITH waits AS (
  SELECT COALESCE(scheduling_mode::text, 'UNSPECIFIED') AS routing_strategy,
         EXTRACT(EPOCH FROM (service_start - GREATEST(ready_at, arrival_time))) / 60.0 AS wait_minutes,
         status::text AS status
  FROM patient_journey_tasks WHERE service_start IS NOT NULL AND COALESCE(ready_at, arrival_time) IS NOT NULL
)
SELECT routing_strategy, count(*) AS tasks,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY wait_minutes) AS median_wait,
       percentile_cont(0.80) WITHIN GROUP (ORDER BY wait_minutes) AS p80_wait,
       count(*) FILTER (WHERE status = 'COMPLETED') AS completed_tasks
FROM waits WHERE wait_minutes >= 0 GROUP BY routing_strategy ORDER BY median_wait;

