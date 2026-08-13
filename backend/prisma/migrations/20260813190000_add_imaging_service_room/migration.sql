-- Add a staffed imaging department and service-capable room for demo routing.
INSERT INTO "departments" ("id", "name", "code", "is_active", "created_at", "updated_at")
VALUES ('IMAGING', 'Khoa Chẩn đoán hình ảnh', 'IMAGING', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "clinical_specialties" (
  "id", "department_id", "name", "code", "is_active", "created_at", "updated_at"
)
VALUES (
  'SPEC-IMAGING', 'IMAGING', 'Chẩn đoán hình ảnh', 'SPEC-IMAGING', TRUE,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "department_id" = EXCLUDED."department_id",
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "staff_users" (
  "id", "username", "password_hash", "full_name", "role", "status", "created_at", "updated_at"
)
VALUES (
  'STAFF-IMAGING-001',
  'bs.nguyen.thu.huong@vaic.vn',
  'pbkdf2:120000:384bf50b9b377057b60879dd86862f79:f7e6048260707a956e6b2c30587403f43a542aaf6ae279395c9f383880f438f58ec3670a8de590e65122bb9095e54da8e4c1b1504b797100fe83e81c211b0faa',
  'BS. Nguyễn Thu Hương',
  'DOCTOR',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO UPDATE SET
  "full_name" = EXCLUDED."full_name",
  "role" = 'DOCTOR',
  "status" = 'ACTIVE',
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "clinic_rooms" (
  "id", "specialty_id", "doctor_id", "name", "code", "floor", "is_active", "created_at", "updated_at"
)
VALUES (
  'ROOM-IMAGING-501',
  'SPEC-IMAGING',
  (SELECT "id" FROM "staff_users" WHERE "username" = 'bs.nguyen.thu.huong@vaic.vn'),
  'Phòng Chẩn đoán hình ảnh 501',
  'CDHA-501',
  'Tầng 5',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "specialty_id" = EXCLUDED."specialty_id",
  "doctor_id" = EXCLUDED."doctor_id",
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "floor" = EXCLUDED."floor",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "service_queues" (
  "id", "name", "room_id", "service_type", "is_active",
  "estimated_wait_minutes", "created_at", "updated_at"
)
VALUES
  (
    'QUEUE-ROOM-IMAGING-501-XRAY',
    'Hàng đợi X-quang - Phòng Chẩn đoán hình ảnh 501',
    'ROOM-IMAGING-501',
    'XRAY',
    TRUE,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'QUEUE-ROOM-IMAGING-501-ULTRASOUND',
    'Hàng đợi Siêu âm - Phòng Chẩn đoán hình ảnh 501',
    'ROOM-IMAGING-501',
    'ABDOMINAL_ULTRASOUND',
    TRUE,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "room_id" = EXCLUDED."room_id",
  "service_type" = EXCLUDED."service_type",
  "is_active" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "equipments" (
  "id", "name", "code", "room_id", "status", "created_at", "updated_at"
)
VALUES
  (
    'EQUIP-XRAY-501', 'Máy X-quang 501', 'XRAY-501', 'ROOM-IMAGING-501',
    'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'EQUIP-ULTRASOUND-501', 'Máy Siêu âm 501', 'US-501', 'ROOM-IMAGING-501',
    'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "room_id" = EXCLUDED."room_id",
  "status" = 'ACTIVE',
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "doctor_room_assignments" (
  "id", "doctor_id", "room_id", "role", "status",
  "shift_start", "shift_end", "created_at", "updated_at"
)
VALUES (
  'SHIFT-ROOM-IMAGING-501',
  (SELECT "id" FROM "staff_users" WHERE "username" = 'bs.nguyen.thu.huong@vaic.vn'),
  'ROOM-IMAGING-501',
  'PRIMARY',
  'ACTIVE',
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '10 years',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "doctor_id" = EXCLUDED."doctor_id",
  "room_id" = EXCLUDED."room_id",
  "role" = 'PRIMARY',
  "status" = 'ACTIVE',
  "shift_start" = EXCLUDED."shift_start",
  "shift_end" = EXCLUDED."shift_end",
  "updated_at" = CURRENT_TIMESTAMP;

-- Preserve task history while moving misrouted imaging work to the compatible room.
UPDATE "patient_queue_entries" AS entry
SET
  "queue_id" = CASE task."service_type"
    WHEN 'XRAY' THEN 'QUEUE-ROOM-IMAGING-501-XRAY'
    WHEN 'ABDOMINAL_ULTRASOUND' THEN 'QUEUE-ROOM-IMAGING-501-ULTRASOUND'
  END,
  "updated_at" = CURRENT_TIMESTAMP
FROM "patient_journey_tasks" AS task
WHERE entry."task_id" = task."task_id"
  AND task."task_type" = 'DIAGNOSTIC_SERVICE'
  AND task."service_type" IN ('XRAY', 'ABDOMINAL_ULTRASOUND')
  AND task."room_id" IS DISTINCT FROM 'ROOM-IMAGING-501';

UPDATE "patient_journey_tasks"
SET
  "department_id" = 'IMAGING',
  "specialty_id" = 'SPEC-IMAGING',
  "room_id" = 'ROOM-IMAGING-501',
  "queue_id" = CASE "service_type"
    WHEN 'XRAY' THEN 'QUEUE-ROOM-IMAGING-501-XRAY'
    WHEN 'ABDOMINAL_ULTRASOUND' THEN 'QUEUE-ROOM-IMAGING-501-ULTRASOUND'
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "task_type" = 'DIAGNOSTIC_SERVICE'
  AND "service_type" IN ('XRAY', 'ABDOMINAL_ULTRASOUND')
  AND "room_id" IS DISTINCT FROM 'ROOM-IMAGING-501';

-- Consultation rooms must never advertise imaging capability.
UPDATE "service_queues"
SET "service_type" = 'CLINICAL_CONSULT', "updated_at" = CURRENT_TIMESTAMP
WHERE "room_id" <> 'ROOM-IMAGING-501'
  AND "service_type" IN ('XRAY', 'ABDOMINAL_ULTRASOUND');
