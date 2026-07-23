-- Grain: one row per quality check. Read-only PostgreSQL validation.
WITH checks AS (
  SELECT 'duplicate task_id' AS check_name, count(*) - count(DISTINCT task_id) AS failures FROM patient_journey_tasks
  UNION ALL SELECT 'missing journey_id', count(*) FILTER (WHERE journey_id IS NULL) FROM patient_journey_tasks
  UNION ALL SELECT 'negative actual_wait_time', count(*) FILTER (WHERE actual_wait_time < 0) FROM patient_journey_tasks
  UNION ALL SELECT 'service_end before service_start', count(*) FILTER (WHERE service_end < service_start) FROM patient_journey_tasks
  UNION ALL SELECT 'service_start before ready_at', count(*) FILTER (WHERE service_start < ready_at) FROM patient_journey_tasks
  UNION ALL SELECT 'orphan journey', count(*) FROM patient_journey_tasks t LEFT JOIN patient_journeys j USING (journey_id) WHERE j.journey_id IS NULL
)
SELECT check_name, failures FROM checks ORDER BY failures DESC, check_name;

