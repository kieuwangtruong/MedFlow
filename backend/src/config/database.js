const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const envConfig = require('./env');

if (!envConfig.databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize Prisma');
}

const adapter = new PrismaPg({ connectionString: envConfig.databaseUrl });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
