const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');

const AppError = require('../../errors/app-error');
const prisma = require('../../config/database');
const { createAccessToken } = require('./token');
const { currentQueueEntry, formatQueueNumber } = require('../shared/presenters');

const activeTaskStatuses = ['PENDING', 'READY', 'IN_QUEUE', 'IN_SERVICE', 'WAITING_RESULT'];

function buildPatientToken() {
  return `pt_${crypto.randomBytes(16).toString('hex')}`;
}

function toAuthUser(patient) {
  return {
    id: patient.id,
    full_name: patient.fullName || `Benh nhan ${patient.identificationCode}`,
    role: 'PATIENT',
    cccd: patient.identificationCode,
    patient_token: patient.patientToken,
    date_of_birth: patient.dateOfBirth?.toISOString().slice(0, 10),
    phone_number: patient.phoneNumber || undefined,
  };
}

function toStaffAuthUser(staffUser) {
  let appRole = 'DOCTOR';
  if (staffUser.role === 'ADMIN') {
    appRole = 'ADMIN';
  } else if (staffUser.role === 'NURSE' || staffUser.role === 'RECEPTIONIST' || staffUser.role === 'STAFF') {
    appRole = 'RECEPTION';
  } else {
    appRole = 'DOCTOR';
  }

  return {
    id: staffUser.id,
    full_name: staffUser.fullName || staffUser.username,
    role: appRole,
    email: staffUser.username,
    staff_role: staffUser.role,
  };
}

function timingSafeTextEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;

  if (passwordHash.startsWith('sha256:')) {
    return timingSafeTextEqual(hashSha256(password), passwordHash.slice('sha256:'.length));
  }

  if (passwordHash.startsWith('pbkdf2:')) {
    const [, iterationsText, salt, expectedHash] = passwordHash.split(':');
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations <= 0 || !salt || !expectedHash) return false;

    const actualHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    return timingSafeTextEqual(actualHash, expectedHash);
  }

  return timingSafeTextEqual(password, passwordHash);
}

async function findActivePatientVisit(patientToken) {
  const journey = await prisma.patientJourney.findFirst({
    where: {
      patientToken,
      tasks: { some: { status: { in: activeTaskStatuses } } },
    },
    include: {
      tasks: {
        where: { status: { in: activeTaskStatuses } },
        include: { queueEntries: { orderBy: { enqueuedAt: 'desc' } } },
        orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!journey?.tasks[0]) return null;
  const entry = currentQueueEntry(journey.tasks[0]);
  return {
    visitId: journey.id,
    queueNumber: formatQueueNumber(entry?.queueNumber),
  };
}

async function loginWithCccd(cccd, fullName) {
  const normalizedFullName = fullName?.trim().replace(/\s+/g, ' ') || null;
  const existingPatient = await prisma.patient.findUnique({
    where: { identificationCode: cccd },
  });
  const patient = existingPatient
    ? await prisma.patient.update({
      where: { id: existingPatient.id },
      data: {
        status: 'ACTIVE',
        ...(!existingPatient.fullName && normalizedFullName
          ? { fullName: normalizedFullName }
          : {}),
      },
    })
    : await prisma.patient.create({
      data: {
        identificationCode: cccd,
        patientToken: buildPatientToken(),
        fullName: normalizedFullName,
        status: 'ACTIVE',
      },
    });
  const user = toAuthUser(patient);
  let activeVisit = null;
  try {
    activeVisit = await findActivePatientVisit(patient.patientToken);
  } catch (visitError) {
    console.error('Non-fatal: could not query active patient visit:', visitError.message || visitError);
  }
  const accessToken = createAccessToken({
    sub: patient.id,
    role: user.role,
    cccd: patient.identificationCode,
    patient_token: patient.patientToken,
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    user,
    active_visit: activeVisit,
  };
}

async function loginStaff(userName, password) {
  const normalizedUserName = userName.trim();
  const lowerUserName = normalizedUserName.toLowerCase();
  const staffUser = await prisma.staffUser.findFirst({
    where: {
      OR: [
        { username: normalizedUserName },
        ...(lowerUserName === normalizedUserName ? [] : [{ username: lowerUserName }]),
      ],
    },
  });

  if (
    !staffUser ||
    staffUser.status !== 'ACTIVE' ||
    !verifyPassword(password, staffUser.passwordHash)
  ) {
    throw new AppError('Tài khoản hoặc mật khẩu chưa đúng', 401, 'INVALID_CREDENTIALS');
  }

  await prisma.staffUser.update({
    where: { id: staffUser.id },
    data: { lastLoginAt: new Date() },
  });

  const user = toStaffAuthUser(staffUser);
  const accessToken = createAccessToken({
    sub: staffUser.id,
    role: user.role,
    staff_role: staffUser.role,
    email: staffUser.username,
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    user,
  };
}

module.exports = {
  loginWithCccd,
  loginStaff,
};
