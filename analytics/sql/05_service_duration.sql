-- Grain: service type. Service duration is end minus start, not elapsed wall time from arrival.
WITH durations AS (
  SELECT service_type::text AS service_type,
         EXTRACT(EPOCH FROM (service_end - service_start)) / 60.0 AS minutes
  FROM patient_journey_tasks WHERE service_start IS NOT NULL AND service_end IS NOT NULL
)
SELECT service_type, count(*) AS completed_tasks, round(avg(minutes)::numeric, 2) AS average_minutes,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY minutes) AS p50_minutes,
       percentile_cont(0.90) WITHIN GROUP (ORDER BY minutes) AS p90_minutes
FROM durations WHERE minutes >= 0 GROUP BY service_type ORDER BY average_minutes DESC;

