-- Remove covering assignment for room 301 from BS. Minh Khang (Khang exclusively manages room 101)
DELETE FROM "doctor_room_assignments"
WHERE "id" = 'SHIFT-ROOM-PED-301-COVERING-KHANG';
