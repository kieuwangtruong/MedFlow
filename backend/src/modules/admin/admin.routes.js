const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const controller = require('./admin.controller');

const router = express.Router();
router.use(authenticate);
router.get('/dashboard', authorize('ADMIN'), controller.dashboard);
router.get('/live-visits', authorize('ADMIN', 'RECEPTION'), controller.liveVisits);
router.get('/rooms', authorize('ADMIN'), controller.rooms);
router.patch('/rooms/:roomId/status', authorize('ADMIN'), controller.updateRoomStatus);
router.get('/doctors', authorize('ADMIN'), controller.doctors);

module.exports = router;
