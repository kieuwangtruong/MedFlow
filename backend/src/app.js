const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const envConfig = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error');

const app = express();

function corsOrigin(value) {
  const normalized = value.trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^(localhost|127\.0\.0\.1)(:|$)/i.test(normalized)) return `http://${normalized}`;
  return `https://${normalized}`;
}

const configuredOrigins = envConfig.appOrigin
  .split(',')
  .map(corsOrigin)
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([
  ...configuredOrigins,
  'http://localhost:3000',
  'http://localhost:5173',
]));
const corsOptions = envConfig.appOrigin === '*'
  ? { origin: '*' }
  : { origin: allowedOrigins, credentials: true };

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
