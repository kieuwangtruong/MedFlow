const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');

const AppError = require('../../errors/app-error');
const prisma = require('../../config/database');
const { createAccessToken } = require('./token');

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
  };
}

function toStaffAuthUser(staffUser) {
  const appRole = staffUser.role === 'ADMIN' ? 'ADMIN' : 'DOCTOR';

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

async function loginWithCccd(cccd) {
  const patient = await prisma.patient.upsert({
    where: { identificationCode: cccd },
    create: {
      identificationCode: cccd,
      patientToken: buildPatientToken(),
      status: 'ACTIVE',
    },
    update: {
      status: 'ACTIVE',
    },
  });
  const user = toAuthUser(patient);
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
