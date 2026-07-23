-- CreateEnum
CREATE TYPE "DoctorRoomAssignmentRole" AS ENUM ('PRIMARY', 'SUPPORT', 'COVERING');

-- CreateEnum
CREATE TYPE "DoctorRoomAssignmentStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "doctor_room_assignments" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "role" "DoctorRoomAssignmentRole" NOT NULL DEFAULT 'PRIMARY',
    "status" "DoctorRoomAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "shift_start" TIMESTAMPTZ(6) NOT NULL,
    "shift_end" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_room_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doctor_room_assignments_valid_shift_check" CHECK ("shift_end" > "shift_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_room_assignments_doctor_id_room_id_shift_start_key"
ON "doctor_room_assignments"("doctor_id", "room_id", "shift_start");

-- CreateIndex
CREATE INDEX "doctor_room_assignments_doctor_id_status_shift_start_shift_end_idx"
ON "doctor_room_assignments"("doctor_id", "status", "shift_start", "shift_end");

-- CreateIndex
CREATE INDEX "doctor_room_assignments_room_id_status_shift_start_shift_end_idx"
ON "doctor_room_assignments"("room_id", "status", "shift_start", "shift_end");

-- At most one active room per doctor and one primary doctor per active room.
CREATE UNIQUE INDEX "doctor_room_assignments_one_active_room_per_doctor_idx"
ON "doctor_room_assignments"("doctor_id") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "doctor_room_assignments_one_active_doctor_per_room_idx"
ON "doctor_room_assignments"("room_id") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "doctor_room_assignments"
ADD CONSTRAINT "doctor_room_assignments_doctor_id_fkey"
FOREIGN KEY ("doctor_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_room_assignments"
ADD CONSTRAINT "doctor_room_assignments_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "clinic_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
