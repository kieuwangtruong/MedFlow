-- Demo SLA assumptions are centralized in analytics/config/metrics.yml.
WITH waits AS (
  SELECT COALESCE(r.name, t.room_id, t.queue_id, 'UNASSIGNED') AS room,
         t.service_type::text AS service_type, t.clinical_priority::text AS priority,
         EXTRACT(EPOCH FROM (t.service_start - GREATEST(t.ready_at, t.arrival_time))) / 60.0 AS wait_minutes,
         CASE t.clinical_priority::text WHEN 'EMERGENCY' THEN 5 WHEN 'URGENT' THEN 15 WHEN 'NON_URGENT' THEN 60 ELSE 30 END AS sla_minutes
  FROM patient_journey_tasks t LEFT JOIN clinic_rooms r ON r.id = t.room_id
  WHERE t.service_start IS NOT NULL AND COALESCE(t.ready_at, t.arrival_time) IS NOT NULL
)
SELECT room, service_type, priority, count(*) AS measurable_tasks,
       count(*) FILTER (WHERE wait_minutes > sla_minutes) AS breached_tasks,
       round((count(*) FILTER (WHERE wait_minutes > sla_minutes)::numeric / NULLIF(count(*), 0)) * 100, 2) AS breach_rate_pct
FROM waits WHERE wait_minutes >= 0 GROUP BY room, service_type, priority ORDER BY breach_rate_pct DESC;

