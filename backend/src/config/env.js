const crypto = require('node:crypto');
require('dotenv').config({ quiet: true });

const DEFAULT_PORT = 3000;
const parsedPort = Number(process.env.PORT);
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function positiveInteger(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredProductionValue(name, developmentFallback = '') {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (!isProduction) return developmentFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

const envConfig = {
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
  appOrigin: requiredProductionValue('APP_ORIGIN', 'http://localhost:5173'),
  databaseUrl: requiredProductionValue('DATABASE_URL'),
  aiServiceUrl: requiredProductionValue('AI_SERVICE_URL', 'http://localhost:8000'),
  aiServiceApiKey: process.env.AI_SERVICE_API_KEY || '',
  aiRequestTimeoutMs: positiveInteger('AI_REQUEST_TIMEOUT_MS', 90_000),
  jwtSecret: requiredProductionValue('JWT_SECRET', crypto.randomBytes(32).toString('hex')),
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 12,
  nodeEnv,
  redisUrl: process.env.REDIS_URL || ''
};

module.exports = envConfig;
