CREATE TYPE "IntakeSource" AS ENUM ('PATIENT_SELF', 'STAFF_DESK', 'KIOSK');

ALTER TABLE "patient_journeys"
  ADD COLUMN "symptom_description" TEXT,
  ADD COLUMN "symptom_payload" JSONB,
  ADD COLUMN "symptoms_submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN "intake_source" "IntakeSource";

