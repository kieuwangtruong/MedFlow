-- AlterTable patient_journeys: Add initial_room_id, current_room_id, queue_status
ALTER TABLE "patient_journeys"
  ADD COLUMN IF NOT EXISTS "initial_room_id" TEXT,
  ADD COLUMN IF NOT EXISTS "current_room_id" TEXT,
  ADD COLUMN IF NOT EXISTS "queue_status" TEXT;

-- AlterTable patient_journey_tasks: Add origin_room_id for return routing
ALTER TABLE "patient_journey_tasks"
  ADD COLUMN IF NOT EXISTS "origin_room_id" TEXT;

-- AlterTable patient_queue_entries: Add is_priority_bump flag for returning patients
ALTER TABLE "patient_queue_entries"
  ADD COLUMN IF NOT EXISTS "is_priority_bump" BOOLEAN NOT NULL DEFAULT false;
