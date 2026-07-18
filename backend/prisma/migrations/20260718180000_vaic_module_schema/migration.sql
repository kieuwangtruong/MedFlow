-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED');

-- CreateEnum
CREATE TYPE "JourneyStep" AS ENUM ('INITIAL_CONSULT', 'DIAGNOSTIC_SERVICE', 'RESULT_PENDING', 'RETURN_REVIEW');

-- CreateEnum
CREATE TYPE "PatientTaskType" AS ENUM ('INITIAL_CONSULT', 'DIAGNOSTIC_SERVICE', 'RETURN_REVIEW');

-- CreateEnum
CREATE TYPE "PatientTaskStatus" AS ENUM ('PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT', 'COMPLETED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CLINICAL_CONSULT', 'XRAY', 'ABDOMINAL_ULTRASOUND', 'RESULT_REVIEW');

-- CreateEnum
CREATE TYPE "ClinicalPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('COMPLETED', 'RESULT_PENDING');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('FAIR_QUEUE', 'SCHEDULED_WINDOW');

-- CreateEnum
CREATE TYPE "ResultUrgency" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "ReturnTiming" AS ENUM ('EARLY', 'ON_TIME', 'LATE');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('AVAILABLE');

-- CreateEnum
CREATE TYPE "CaseComplexity" AS ENUM ('SIMPLE', 'NORMAL', 'COMPLEX');

-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('WAITING', 'CALLED', 'IN_SERVICE', 'DONE', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "identification_code" TEXT NOT NULL,
    "patient_token" TEXT NOT NULL,
    "full_name" TEXT,
    "phone_number" TEXT,
    "date_of_birth" DATE,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_rooms" (
    "id" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "floor" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_specialties" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_queues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_id" TEXT,
    "service_type" "ServiceType",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_journeys" (
    "journey_id" TEXT NOT NULL,
    "patient_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_journeys_pkey" PRIMARY KEY ("journey_id")
);

-- CreateTable
CREATE TABLE "patient_journey_tasks" (
    "task_id" TEXT NOT NULL,
    "journey_id" TEXT NOT NULL,
    "journey_step" "JourneyStep" NOT NULL,
    "parent_task_id" TEXT,
    "depends_on_task_id" TEXT,
    "patient_token" TEXT NOT NULL,
    "department_id" TEXT,
    "specialty_id" TEXT,
    "queue_id" TEXT,
    "room_id" TEXT,
    "task_type" "PatientTaskType" NOT NULL,
    "status" "PatientTaskStatus" NOT NULL DEFAULT 'PENDING',
    "service_type" "ServiceType" NOT NULL,
    "clinical_priority" "ClinicalPriority" NOT NULL DEFAULT 'NORMAL',
    "readiness_status" "ReadinessStatus",
    "scheduling_mode" "SchedulingMode",
    "doctor_id" TEXT,
    "device_id" TEXT,
    "assigned_at" TIMESTAMPTZ(6),
    "arrival_time" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "service_start" TIMESTAMPTZ(6),
    "service_end" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "result_ready_at" TIMESTAMPTZ(6),
    "result_urgency" "ResultUrgency",
    "result_delay_minutes" DOUBLE PRECISION,
    "return_timing" "ReturnTiming",
    "schedule_window_start" TIMESTAMPTZ(6),
    "schedule_window_end" TIMESTAMPTZ(6),
    "sequence_order" INTEGER,
    "queue_length" INTEGER,
    "arrival_rate_15m" INTEGER,
    "avg_service_30m" DOUBLE PRECISION,
    "resource_status" "ResourceStatus",
    "resource_failure" BOOLEAN NOT NULL DEFAULT false,
    "doctor_pause" BOOLEAN NOT NULL DEFAULT false,
    "case_complexity" "CaseComplexity",
    "active_service_duration" DOUBLE PRECISION,
    "interruption_duration" DOUBLE PRECISION,
    "elapsed_service_duration" DOUBLE PRECISION,
    "actual_wait_time" DOUBLE PRECISION,
    "no_show" BOOLEAN NOT NULL DEFAULT false,
    "emergency_insertion" BOOLEAN NOT NULL DEFAULT false,
    "recent_emergency_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_journey_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "patient_task_dependencies" (
    "id" SERIAL NOT NULL,
    "task_id" TEXT NOT NULL,
    "depends_on_task_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_queue_entries" (
    "id" TEXT NOT NULL,
    "queue_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'WAITING',
    "priority" "ClinicalPriority" NOT NULL DEFAULT 'NORMAL',
    "queue_number" INTEGER,
    "position" INTEGER,
    "enqueued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "called_at" TIMESTAMPTZ(6),
    "service_start_at" TIMESTAMPTZ(6),
    "service_end_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_slot_statistics" (
    "id" SERIAL NOT NULL,
    "checkin_time" TIMESTAMP(0) NOT NULL,
    "date" DATE NOT NULL,
    "slot_start" VARCHAR(5) NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "day_name" VARCHAR(16) NOT NULL,
    "month" INTEGER NOT NULL,
    "is_weekend" BOOLEAN NOT NULL,
    "checkin_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkin_slot_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_username_key" ON "staff_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "patients_identification_code_key" ON "patients"("identification_code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patient_token_key" ON "patients"("patient_token");

-- CreateIndex
CREATE INDEX "patients_patient_token_idx" ON "patients"("patient_token");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_rooms_code_key" ON "clinic_rooms"("code");

-- CreateIndex
CREATE INDEX "clinic_rooms_specialty_id_idx" ON "clinic_rooms"("specialty_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_rooms_specialty_id_name_key" ON "clinic_rooms"("specialty_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_specialties_code_key" ON "clinical_specialties"("code");

-- CreateIndex
CREATE INDEX "clinical_specialties_department_id_idx" ON "clinical_specialties"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_specialties_department_id_name_key" ON "clinical_specialties"("department_id", "name");

-- CreateIndex
CREATE INDEX "service_queues_room_id_idx" ON "service_queues"("room_id");

-- CreateIndex
CREATE INDEX "service_queues_service_type_idx" ON "service_queues"("service_type");

-- CreateIndex
CREATE INDEX "patient_journeys_patient_token_idx" ON "patient_journeys"("patient_token");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_journey_id_journey_step_idx" ON "patient_journey_tasks"("journey_id", "journey_step");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_parent_task_id_idx" ON "patient_journey_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_patient_token_idx" ON "patient_journey_tasks"("patient_token");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_department_id_status_idx" ON "patient_journey_tasks"("department_id", "status");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_specialty_id_status_idx" ON "patient_journey_tasks"("specialty_id", "status");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_queue_id_status_idx" ON "patient_journey_tasks"("queue_id", "status");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_room_id_status_idx" ON "patient_journey_tasks"("room_id", "status");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_doctor_id_service_start_idx" ON "patient_journey_tasks"("doctor_id", "service_start");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_device_id_service_start_idx" ON "patient_journey_tasks"("device_id", "service_start");

-- CreateIndex
CREATE INDEX "patient_journey_tasks_service_type_arrival_time_idx" ON "patient_journey_tasks"("service_type", "arrival_time");

-- CreateIndex
CREATE INDEX "patient_task_dependencies_depends_on_task_id_idx" ON "patient_task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_task_dependencies_task_id_depends_on_task_id_key" ON "patient_task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "patient_queue_entries_queue_id_status_priority_enqueued_at_idx" ON "patient_queue_entries"("queue_id", "status", "priority", "enqueued_at");

-- CreateIndex
CREATE INDEX "patient_queue_entries_task_id_idx" ON "patient_queue_entries"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_queue_entries_task_id_queue_id_key" ON "patient_queue_entries"("task_id", "queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_slot_statistics_checkin_time_key" ON "checkin_slot_statistics"("checkin_time");

-- CreateIndex
CREATE INDEX "checkin_slot_statistics_date_idx" ON "checkin_slot_statistics"("date");

-- CreateIndex
CREATE INDEX "checkin_slot_statistics_slot_index_idx" ON "checkin_slot_statistics"("slot_index");

-- CreateIndex
CREATE INDEX "checkin_slot_statistics_day_of_week_slot_index_idx" ON "checkin_slot_statistics"("day_of_week", "slot_index");

-- CreateIndex
CREATE INDEX "checkin_slot_statistics_month_slot_index_idx" ON "checkin_slot_statistics"("month", "slot_index");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_slot_statistics_date_slot_index_key" ON "checkin_slot_statistics"("date", "slot_index");

-- AddForeignKey
ALTER TABLE "clinic_rooms" ADD CONSTRAINT "clinic_rooms_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "clinical_specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_specialties" ADD CONSTRAINT "clinical_specialties_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_queues" ADD CONSTRAINT "service_queues_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "clinic_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journeys" ADD CONSTRAINT "patient_journeys_patient_token_fkey" FOREIGN KEY ("patient_token") REFERENCES "patients"("patient_token") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "patient_journeys"("journey_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_patient_token_fkey" FOREIGN KEY ("patient_token") REFERENCES "patients"("patient_token") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "patient_journey_tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "clinical_specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "service_queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journey_tasks" ADD CONSTRAINT "patient_journey_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "clinic_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_task_dependencies" ADD CONSTRAINT "patient_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "patient_journey_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_task_dependencies" ADD CONSTRAINT "patient_task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "patient_journey_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_queue_entries" ADD CONSTRAINT "patient_queue_entries_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "service_queues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_queue_entries" ADD CONSTRAINT "patient_queue_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "patient_journey_tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;
