const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const controller = require('./ai-gateway.controller');

const router = express.Router();

router.get('/health', controller.health);
router.post('/forecasts', controller.forecasts);
router.get('/rooms/status', controller.roomsStatus);
router.post('/room-options', controller.roomOptions);
router.get('/patients/:patientToken/estimate', controller.patientEstimate);
router.get('/journeys/:journeyId/estimate', controller.journeyEstimate);
router.post('/events', controller.events);
router.post('/assignment-impact', controller.assignmentImpact);
router.post('/simulations/scenario', controller.scenario);
router.post('/fastest-room', authenticate, authorize('DOCTOR', 'ADMIN'), controller.fastestRoom);

module.exports = router;
