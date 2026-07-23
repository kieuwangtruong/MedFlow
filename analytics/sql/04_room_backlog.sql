-- Grain: room/queue. Active backlog excludes terminal task states.
SELECT COALESCE(r.name, t.room_id, t.queue_id, 'UNASSIGNED') AS room,
       count(*) FILTER (WHERE t.status::text IN ('PENDING','READY','IN_QUEUE','IN_SERVICE','WAITING_RESULT')) AS backlog_tasks,
       COALESCE(sum(CASE WHEN t.status::text IN ('PENDING','READY','IN_QUEUE','IN_SERVICE')
                         THEN COALESCE(t.avg_service_30m, t.elapsed_service_duration, 0) ELSE 0 END), 0) AS backlog_minutes,
       max(t.queue_length) AS observed_queue_length
FROM patient_journey_tasks t LEFT JOIN clinic_rooms r ON r.id = t.room_id
GROUP BY room ORDER BY backlog_tasks DESC, backlog_minutes DESC;

