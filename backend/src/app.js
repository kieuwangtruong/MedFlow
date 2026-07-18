const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const envConfig = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error');

const app = express();
const configuredOrigins = envConfig.appOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...configuredOrigins, 'http://localhost:3000']));
const corsOptions =
  envConfig.appOrigin === '*' ? { origin: '*' } : { origin: allowedOrigins, credentials: true };

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
