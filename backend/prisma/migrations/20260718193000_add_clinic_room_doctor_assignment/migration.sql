-- AlterTable
ALTER TABLE "clinic_rooms" ADD COLUMN "doctor_id" TEXT;

-- CreateIndex
CREATE INDEX "clinic_rooms_doctor_id_idx" ON "clinic_rooms"("doctor_id");

-- AddForeignKey
ALTER TABLE "clinic_rooms" ADD CONSTRAINT "clinic_rooms_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
