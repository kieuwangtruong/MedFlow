const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const envConfig = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error');

const app = express();
const corsOptions =
  envConfig.appOrigin === '*' ? { origin: '*' } : { origin: envConfig.appOrigin, credentials: true };

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
