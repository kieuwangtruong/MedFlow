-- Grain: local calendar date and hour; distinct journeys avoid task double counting.
SELECT (COALESCE(checkin_at, arrival_time) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS local_date,
       EXTRACT(hour FROM COALESCE(checkin_at, arrival_time) AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS local_hour,
       count(DISTINCT t.journey_id) AS patients, count(DISTINCT t.task_id) AS tasks
FROM patient_journey_tasks t JOIN patient_journeys j USING (journey_id)
WHERE COALESCE(checkin_at, arrival_time) IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;

