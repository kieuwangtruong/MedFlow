const express = require('express');
const healthRoutes = require('../modules/health/health.routes');
const routingRoutes = require('../modules/routing/routing.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/routing', routingRoutes);

module.exports = router;
