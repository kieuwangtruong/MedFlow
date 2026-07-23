-- Denominator: non-cancelled tasks. Queue NO_SHOW is reconciled with task.no_show.
SELECT COALESCE(r.name, t.room_id, t.queue_id, 'UNASSIGNED') AS room,
       t.service_type::text AS service_type, count(*) AS eligible_tasks,
       count(*) FILTER (WHERE t.no_show OR q.status::text = 'NO_SHOW') AS no_show_tasks,
       round(100.0 * count(*) FILTER (WHERE t.no_show OR q.status::text = 'NO_SHOW') / NULLIF(count(*), 0), 2) AS no_show_rate_pct
FROM patient_journey_tasks t
LEFT JOIN patient_queue_entries q ON q.task_id = t.task_id AND q.queue_id = t.queue_id
LEFT JOIN clinic_rooms r ON r.id = t.room_id
WHERE t.status::text <> 'CANCELLED'
GROUP BY room, t.service_type ORDER BY no_show_rate_pct DESC;

