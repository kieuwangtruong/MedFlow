-- Grain: room. Operational wait uses service_start - max(ready_at, arrival_time).
WITH waits AS (
  SELECT COALESCE(r.name, t.room_id, t.queue_id, 'UNASSIGNED') AS room,
         EXTRACT(EPOCH FROM (t.service_start - GREATEST(t.ready_at, t.arrival_time))) / 60.0 AS wait_minutes
  FROM patient_journey_tasks t LEFT JOIN clinic_rooms r ON r.id = t.room_id
  WHERE t.service_start IS NOT NULL AND COALESCE(t.ready_at, t.arrival_time) IS NOT NULL
    AND (:date_from IS NULL OR t.service_start >= CAST(:date_from AS timestamptz))
    AND (:date_to IS NULL OR t.service_start < CAST(:date_to AS timestamptz))
)
SELECT room, count(*) AS tasks,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY wait_minutes) AS p50_minutes,
       percentile_cont(0.80) WITHIN GROUP (ORDER BY wait_minutes) AS p80_minutes,
       percentile_cont(0.90) WITHIN GROUP (ORDER BY wait_minutes) AS p90_minutes
FROM waits WHERE wait_minutes >= 0 GROUP BY room ORDER BY p80_minutes DESC;
