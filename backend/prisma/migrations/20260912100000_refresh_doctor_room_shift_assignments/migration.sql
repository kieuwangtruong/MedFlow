-- Ensure all existing doctor room assignments are active and extended into the future
UPDATE "doctor_room_assignments"
SET "status" = 'ACTIVE',
    "shift_start" = CURRENT_TIMESTAMP - INTERVAL '1 day',
    "shift_end" = CURRENT_TIMESTAMP + INTERVAL '365 days',
    "updated_at" = CURRENT_TIMESTAMP;

-- Ensure BS. Nguyễn Minh Khang has an active primary shift for ROOM-GENERAL-101
INSERT INTO "doctor_room_assignments" (
  "id", "doctor_id", "room_id", "role", "status", "shift_start", "shift_end", "created_at", "updated_at"
)
SELECT
  'SHIFT-ROOM-GENERAL-101',
  u."id",
  'ROOM-GENERAL-101',
  'PRIMARY',
  'ACTIVE',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '365 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "staff_users" u
WHERE u."username" = 'bs.nguyen.minh.khang@vaic.vn'
ON CONFLICT ("id") DO UPDATE SET
  "status" = 'ACTIVE',
  "shift_start" = CURRENT_TIMESTAMP - INTERVAL '1 day',
  "shift_end" = CURRENT_TIMESTAMP + INTERVAL '365 days',
  "updated_at" = CURRENT_TIMESTAMP;

-- Ensure BS. Bùi Tuấn Kiệt has an active primary shift for ROOM-PED-301
INSERT INTO "doctor_room_assignments" (
  "id", "doctor_id", "room_id", "role", "status", "shift_start", "shift_end", "created_at", "updated_at"
)
SELECT
  'SHIFT-ROOM-PED-301',
  u."id",
  'ROOM-PED-301',
  'PRIMARY',
  'ACTIVE',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '365 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "staff_users" u
WHERE u."username" = 'bs.bui.tuan.kiet@vaic.vn'
ON CONFLICT ("id") DO UPDATE SET
  "status" = 'ACTIVE',
  "shift_start" = CURRENT_TIMESTAMP - INTERVAL '1 day',
  "shift_end" = CURRENT_TIMESTAMP + INTERVAL '365 days',
  "updated_at" = CURRENT_TIMESTAMP;

-- Assign BS. Nguyễn Minh Khang as COVERING doctor for ROOM-PED-301 so Khang can also manage room 301
INSERT INTO "doctor_room_assignments" (
  "id", "doctor_id", "room_id", "role", "status", "shift_start", "shift_end", "created_at", "updated_at"
)
SELECT
  'SHIFT-ROOM-PED-301-COVERING-KHANG',
  u."id",
  'ROOM-PED-301',
  'COVERING',
  'ACTIVE',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '365 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "staff_users" u
WHERE u."username" = 'bs.nguyen.minh.khang@vaic.vn'
ON CONFLICT ("id") DO UPDATE SET
  "status" = 'ACTIVE',
  "shift_start" = CURRENT_TIMESTAMP - INTERVAL '1 day',
  "shift_end" = CURRENT_TIMESTAMP + INTERVAL '365 days',
  "updated_at" = CURRENT_TIMESTAMP;
