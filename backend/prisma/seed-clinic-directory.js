const crypto = require('node:crypto');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ quiet: true });

const HASH_ITERATIONS = 120000;
const DEFAULT_PASSWORD = process.env.SEED_DOCTOR_PASSWORD || '12345678';

const DEPARTMENTS = [
  { id: 'GENERAL', code: 'GENERAL', name: 'Khoa Khám bệnh Tổng quát' },
  { id: 'ER', code: 'ER', name: 'Khoa Cấp cứu' },
  { id: 'CARD', code: 'CARD', name: 'Khoa Tim mạch' },
  { id: 'NEURO', code: 'NEURO', name: 'Khoa Thần kinh' },
  { id: 'ENT', code: 'ENT', name: 'Khoa Tai Mũi Họng' },
  { id: 'DERM', code: 'DERM', name: 'Khoa Da liễu' },
  { id: 'PED', code: 'PED', name: 'Khoa Nhi' },
  { id: 'OBGYN', code: 'OBGYN', name: 'Khoa Sản Phụ khoa' },
  { id: 'ORTHO', code: 'ORTHO', name: 'Khoa Cơ Xương Khớp' },
  { id: 'GASTRO', code: 'GASTRO', name: 'Khoa Tiêu hóa - Gan mật' },
  { id: 'RESP', code: 'RESP', name: 'Khoa Hô hấp' },
  { id: 'URO', code: 'URO', name: 'Khoa Tiết niệu' },
  { id: 'OPH', code: 'OPH', name: 'Khoa Mắt' },
  { id: 'ENDO', code: 'ENDO', name: 'Khoa Nội tiết' },
  { id: 'PSYCH', code: 'PSYCH', name: 'Khoa Tâm thần - Tâm lý' },
];

const SPECIALTIES = [
  { id: 'SPEC-GENERAL-ADULT', departmentId: 'GENERAL', code: 'SPEC-GENERAL-ADULT', name: 'Khám Nội tổng quát' },
  { id: 'SPEC-ER-TRIAGE', departmentId: 'ER', code: 'SPEC-ER-TRIAGE', name: 'Tiếp nhận và Phân loại cấp cứu' },
  { id: 'SPEC-CARD-CONSULT', departmentId: 'CARD', code: 'SPEC-CARD-CONSULT', name: 'Khám Tim mạch' },
  { id: 'SPEC-NEURO-CONSULT', departmentId: 'NEURO', code: 'SPEC-NEURO-CONSULT', name: 'Khám Thần kinh' },
  { id: 'SPEC-ENT-CONSULT', departmentId: 'ENT', code: 'SPEC-ENT-CONSULT', name: 'Khám Tai Mũi Họng' },
  { id: 'SPEC-DERM-CONSULT', departmentId: 'DERM', code: 'SPEC-DERM-CONSULT', name: 'Khám Da liễu' },
  { id: 'SPEC-PED-CONSULT', departmentId: 'PED', code: 'SPEC-PED-CONSULT', name: 'Khám Nhi tổng quát' },
  { id: 'SPEC-OBGYN-CONSULT', departmentId: 'OBGYN', code: 'SPEC-OBGYN-CONSULT', name: 'Khám Sản Phụ khoa' },
  { id: 'SPEC-ORTHO-CONSULT', departmentId: 'ORTHO', code: 'SPEC-ORTHO-CONSULT', name: 'Khám Cơ Xương Khớp' },
  { id: 'SPEC-GASTRO-CONSULT', departmentId: 'GASTRO', code: 'SPEC-GASTRO-CONSULT', name: 'Khám Tiêu hóa - Gan mật' },
  { id: 'SPEC-RESP-CONSULT', departmentId: 'RESP', code: 'SPEC-RESP-CONSULT', name: 'Khám Hô hấp' },
  { id: 'SPEC-URO-CONSULT', departmentId: 'URO', code: 'SPEC-URO-CONSULT', name: 'Khám Tiết niệu' },
  { id: 'SPEC-OPH-CONSULT', departmentId: 'OPH', code: 'SPEC-OPH-CONSULT', name: 'Khám Mắt' },
  { id: 'SPEC-ENDO-CONSULT', departmentId: 'ENDO', code: 'SPEC-ENDO-CONSULT', name: 'Khám Nội tiết' },
  { id: 'SPEC-PSYCH-CONSULT', departmentId: 'PSYCH', code: 'SPEC-PSYCH-CONSULT', name: 'Khám Tâm thần - Tâm lý' },
];

const DOCTORS = [
  { username: 'nam01@gmail.com', fullName: 'BS. Nguyễn Văn Nam' },
  { username: 'bs.nguyen.minh.khang@vaic.vn', fullName: 'BS. Nguyễn Minh Khang' },
  { username: 'bs.tran.hoang.lan@vaic.vn', fullName: 'BS. Trần Hoàng Lan' },
  { username: 'bs.le.quang.huy@vaic.vn', fullName: 'BS. Lê Quang Huy' },
  { username: 'bs.pham.thu.ha@vaic.vn', fullName: 'BS. Phạm Thu Hà' },
  { username: 'bs.vo.thanh.dat@vaic.vn', fullName: 'BS. Võ Thành Đạt' },
  { username: 'bs.dang.ngoc.anh@vaic.vn', fullName: 'BS. Đặng Ngọc Anh' },
  { username: 'bs.bui.tuan.kiet@vaic.vn', fullName: 'BS. Bùi Tuấn Kiệt' },
  { username: 'bs.do.my.linh@vaic.vn', fullName: 'BS. Đỗ Mỹ Linh' },
  { username: 'bs.hoang.gia.bao@vaic.vn', fullName: 'BS. Hoàng Gia Bảo' },
  { username: 'bs.ngo.thanh.van@vaic.vn', fullName: 'BS. Ngô Thanh Vân' },
];

const ROOMS = [
  { id: 'ROOM-GENERAL-101', specialtyId: 'SPEC-GENERAL-ADULT', doctorUsername: 'bs.nguyen.minh.khang@vaic.vn', code: 'PK-TQ-101', name: 'Phòng khám Tổng quát 101', floor: 'Tầng 1' },
  { id: 'ROOM-ER-102', specialtyId: 'SPEC-ER-TRIAGE', doctorUsername: 'bs.tran.hoang.lan@vaic.vn', code: 'CC-102', name: 'Phòng Phân loại Cấp cứu 102', floor: 'Tầng 1' },
  { id: 'ROOM-CARD-201', specialtyId: 'SPEC-CARD-CONSULT', doctorUsername: 'bs.le.quang.huy@vaic.vn', code: 'TM-201', name: 'Phòng khám Tim mạch 201', floor: 'Tầng 2' },
  { id: 'ROOM-NEURO-202', specialtyId: 'SPEC-NEURO-CONSULT', doctorUsername: 'bs.pham.thu.ha@vaic.vn', code: 'TK-202', name: 'Phòng khám Thần kinh 202', floor: 'Tầng 2' },
  { id: 'ROOM-ENT-203', specialtyId: 'SPEC-ENT-CONSULT', doctorUsername: 'bs.vo.thanh.dat@vaic.vn', code: 'TMH-203', name: 'Phòng khám Tai Mũi Họng 203', floor: 'Tầng 2' },
  { id: 'ROOM-DERM-204', specialtyId: 'SPEC-DERM-CONSULT', doctorUsername: 'bs.dang.ngoc.anh@vaic.vn', code: 'DL-204', name: 'Phòng khám Da liễu 204', floor: 'Tầng 2' },
  { id: 'ROOM-PED-301', specialtyId: 'SPEC-PED-CONSULT', doctorUsername: 'bs.bui.tuan.kiet@vaic.vn', code: 'NK-301', name: 'Phòng khám Nhi 301', floor: 'Tầng 3' },
  { id: 'ROOM-OBGYN-302', specialtyId: 'SPEC-OBGYN-CONSULT', doctorUsername: 'bs.do.my.linh@vaic.vn', code: 'SPK-302', name: 'Phòng khám Sản Phụ khoa 302', floor: 'Tầng 3' },
  { id: 'ROOM-ORTHO-303', specialtyId: 'SPEC-ORTHO-CONSULT', doctorUsername: 'bs.hoang.gia.bao@vaic.vn', code: 'CXK-303', name: 'Phòng khám Cơ Xương Khớp 303', floor: 'Tầng 3' },
  { id: 'ROOM-GASTRO-304', specialtyId: 'SPEC-GASTRO-CONSULT', doctorUsername: 'bs.ngo.thanh.van@vaic.vn', code: 'TH-304', name: 'Phòng khám Tiêu hóa - Gan mật 304', floor: 'Tầng 3' },
  { id: 'ROOM-RESP-401', specialtyId: 'SPEC-RESP-CONSULT', doctorUsername: 'bs.nguyen.minh.khang@vaic.vn', code: 'HH-401', name: 'Phòng khám Hô hấp 401', floor: 'Tầng 4' },
  { id: 'ROOM-URO-402', specialtyId: 'SPEC-URO-CONSULT', doctorUsername: 'bs.le.quang.huy@vaic.vn', code: 'TN-402', name: 'Phòng khám Tiết niệu 402', floor: 'Tầng 4' },
  { id: 'ROOM-OPH-403', specialtyId: 'SPEC-OPH-CONSULT', doctorUsername: 'bs.tran.hoang.lan@vaic.vn', code: 'MAT-403', name: 'Phòng khám Mắt 403', floor: 'Tầng 4' },
  { id: 'ROOM-ENDO-404', specialtyId: 'SPEC-ENDO-CONSULT', doctorUsername: 'bs.pham.thu.ha@vaic.vn', code: 'NT-404', name: 'Phòng khám Nội tiết 404', floor: 'Tầng 4' },
  { id: 'ROOM-PSYCH-405', specialtyId: 'SPEC-PSYCH-CONSULT', doctorUsername: 'bs.dang.ngoc.anh@vaic.vn', code: 'TTL-405', name: 'Phòng khám Tâm thần - Tâm lý 405', floor: 'Tầng 4' },
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, 64, 'sha512').toString('hex');

  return `pbkdf2:${HASH_ITERATIONS}:${salt}:${hash}`;
}

function publicSummary() {
  return {
    departments: DEPARTMENTS.length,
    doctors: DOCTORS.length,
    clinicalSpecialties: SPECIALTIES.length,
    clinicRooms: ROOMS.length,
  };
}

async function ensureClinicRoomDoctorAssignment(prisma) {
  await prisma.$executeRawUnsafe('ALTER TABLE "clinic_rooms" ADD COLUMN IF NOT EXISTS "doctor_id" TEXT');
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "clinic_rooms_doctor_id_idx" ON "clinic_rooms"("doctor_id")',
  );
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clinic_rooms_doctor_id_fkey'
      ) THEN
        ALTER TABLE "clinic_rooms"
          ADD CONSTRAINT "clinic_rooms_doctor_id_fkey"
          FOREIGN KEY ("doctor_id") REFERENCES "staff_users"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

async function seedClinicDirectory() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to seed clinic directory data');

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await ensureClinicRoomDoctorAssignment(prisma);

    for (const department of DEPARTMENTS) {
      await prisma.department.upsert({
        where: { id: department.id },
        create: { ...department, isActive: true },
        update: { code: department.code, name: department.name, isActive: true },
      });
    }

    const doctorsByUsername = new Map();
    for (const doctor of DOCTORS) {
      const staffUser = await prisma.staffUser.upsert({
        where: { username: doctor.username },
        create: {
          username: doctor.username,
          passwordHash: hashPassword(DEFAULT_PASSWORD),
          fullName: doctor.fullName,
          role: 'DOCTOR',
          status: 'ACTIVE',
        },
        update: {
          fullName: doctor.fullName,
          role: 'DOCTOR',
          status: 'ACTIVE',
        },
      });

      doctorsByUsername.set(staffUser.username, staffUser);
    }

    for (const specialty of SPECIALTIES) {
      await prisma.clinicalSpecialty.upsert({
        where: { id: specialty.id },
        create: { ...specialty, isActive: true },
        update: {
          departmentId: specialty.departmentId,
          code: specialty.code,
          name: specialty.name,
          isActive: true,
        },
      });
    }

    for (const room of ROOMS) {
      const doctor = doctorsByUsername.get(room.doctorUsername);
      await prisma.clinicRoom.upsert({
        where: { id: room.id },
        create: {
          id: room.id,
          specialtyId: room.specialtyId,
          doctorId: doctor.id,
          code: room.code,
          name: room.name,
          floor: room.floor,
          isActive: true,
        },
        update: {
          specialtyId: room.specialtyId,
          doctorId: doctor.id,
          code: room.code,
          name: room.name,
          floor: room.floor,
          isActive: true,
        },
      });
    }

    return {
      seeded: publicSummary(),
      databaseCounts: {
        departments: await prisma.department.count(),
        doctors: await prisma.staffUser.count({ where: { role: 'DOCTOR' } }),
        clinicalSpecialties: await prisma.clinicalSpecialty.count(),
        clinicRooms: await prisma.clinicRoom.count(),
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ dryRun: true, seeded: publicSummary() }, null, 2));
    return;
  }

  const result = await seedClinicDirectory();
  console.log(JSON.stringify({ dryRun: false, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
