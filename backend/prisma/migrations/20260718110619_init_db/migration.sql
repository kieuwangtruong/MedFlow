-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicalPriority" ADD VALUE 'EMERGENCY';
ALTER TYPE "ClinicalPriority" ADD VALUE 'NON_URGENT';

-- AlterTable
ALTER TABLE "patient_journeys" ADD COLUMN     "checkin_at" TIMESTAMPTZ(6),
ADD COLUMN     "severity_score" INTEGER;

-- AlterTable
ALTER TABLE "service_queues" ADD COLUMN     "estimated_wait_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- CreateTable
CREATE TABLE "hospital_edges" (
    "id" TEXT NOT NULL,
    "from_room_id" TEXT NOT NULL,
    "to_room_id" TEXT NOT NULL,
    "travel_minutes" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "room_id" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hospital_edges_from_room_id_idx" ON "hospital_edges"("from_room_id");

-- CreateIndex
CREATE INDEX "hospital_edges_to_room_id_idx" ON "hospital_edges"("to_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_edges_from_room_id_to_room_id_key" ON "hospital_edges"("from_room_id", "to_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_code_key" ON "equipments"("code");

-- CreateIndex
CREATE INDEX "equipments_room_id_idx" ON "equipments"("room_id");

-- AddForeignKey
ALTER TABLE "hospital_edges" ADD CONSTRAINT "hospital_edges_from_room_id_fkey" FOREIGN KEY ("from_room_id") REFERENCES "clinic_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_edges" ADD CONSTRAINT "hospital_edges_to_room_id_fkey" FOREIGN KEY ("to_room_id") REFERENCES "clinic_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "clinic_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
