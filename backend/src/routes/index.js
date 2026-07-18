const express = require('express');
const healthRoutes = require('../modules/health/health.routes');

const router = express.Router();

router.use('/health', healthRoutes);

module.exports = router;
