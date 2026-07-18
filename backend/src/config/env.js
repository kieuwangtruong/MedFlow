require('dotenv').config({ quiet: true });

const DEFAULT_PORT = 3000;
const parsedPort = Number(process.env.PORT);

const envConfig = {
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
  appOrigin: process.env.APP_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'vaic-dev-token-secret-change-me',
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 12,
  nodeEnv: process.env.NODE_ENV || 'development',
  redisUrl: process.env.REDIS_URL || ''
};

module.exports = envConfig;
