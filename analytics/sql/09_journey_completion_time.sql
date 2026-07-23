-- Grain: journey. Completion is last completed/service end minus check-in/first arrival.
WITH journey_times AS (
  SELECT j.journey_id,
         COALESCE(j.checkin_at, min(t.arrival_time)) AS journey_start,
         max(COALESCE(t.completed_at, t.service_end)) AS journey_end,
         bool_or(t.task_type::text = 'INITIAL_CONSULT') AS has_initial,
         bool_or(t.task_type::text = 'DIAGNOSTIC_SERVICE') AS has_diagnostic,
         bool_or(t.task_type::text = 'RETURN_REVIEW') AS has_return
  FROM patient_journeys j JOIN patient_journey_tasks t USING (journey_id)
  GROUP BY j.journey_id, j.checkin_at
)
SELECT journey_id, has_initial AND has_diagnostic AND has_return AS has_a_b_return,
       EXTRACT(EPOCH FROM (journey_end - journey_start)) / 60.0 AS journey_completion_minutes
FROM journey_times WHERE journey_start IS NOT NULL AND journey_end IS NOT NULL ORDER BY journey_completion_minutes DESC;

