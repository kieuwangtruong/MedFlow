require('dotenv').config();

const DEFAULT_PORT = 3000;
const parsedPort = Number(process.env.PORT);

const envConfig = {
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
  appOrigin: process.env.APP_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  redisUrl: process.env.REDIS_URL || ''
};

module.exports = envConfig;
