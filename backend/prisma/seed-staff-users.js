const crypto = require('node:crypto');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ quiet: true });

const HASH_ITERATIONS = 120000;
const STAFF_USERS = [
  {
    username: 'adminamind',
    password: process.env.SEED_ADMIN_PASSWORD || '12345678',
    fullName: 'Quan tri vien',
    role: 'ADMIN',
  },
  {
    username: 'nam01@gmail.com',
    password: process.env.SEED_DOCTOR_PASSWORD || '12345678',
    fullName: 'Nguyễn Văn Nam',
    role: 'DOCTOR',
  },
  {
    username: 'ngan01@gmail.com',
    password: process.env.SEED_NURSE_PASSWORD || '12345678',
    fullName: 'Nguyễn Thảo Ngân',
    role: 'NURSE',
  },

];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, 64, 'sha512').toString('hex');

  return `pbkdf2:${HASH_ITERATIONS}:${salt}:${hash}`;
}

function publicUserSummary(user) {
  return {
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: 'ACTIVE',
  };
}

async function seedStaffUsers() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to seed staff users');

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const results = [];

    for (const user of STAFF_USERS) {
      const staffUser = await prisma.staffUser.upsert({
        where: { username: user.username },
        create: {
          username: user.username,
          passwordHash: hashPassword(user.password),
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
        update: {
          passwordHash: hashPassword(user.password),
          fullName: user.fullName,
          role: user.role,
          status: 'ACTIVE',
        },
      });

      results.push(publicUserSummary(staffUser));
    }

    return results;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ dryRun: true, staffUsers: STAFF_USERS.map(publicUserSummary) }, null, 2));
    return;
  }

  const staffUsers = await seedStaffUsers();
  console.log(JSON.stringify({ dryRun: false, staffUsers }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
