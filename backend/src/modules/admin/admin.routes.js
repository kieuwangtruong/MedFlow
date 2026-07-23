const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const controller = require('./admin.controller');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/dashboard', controller.dashboard);
router.get('/live-visits', controller.liveVisits);
router.get('/rooms', controller.rooms);
router.patch('/rooms/:roomId/status', controller.updateRoomStatus);
router.get('/doctors', controller.doctors);

module.exports = router;
