const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const controller = require('./patient.controller');

const router = express.Router();

router.post('/kiosk/checkins', controller.kioskCheckin);
router.use(authenticate, authorize('PATIENT'));
router.post('/checkins', controller.checkin);
router.get('/notifications', controller.notifications);
router.post('/visits/:visitId/symptoms', controller.submitSymptoms);
router.post('/visits/:visitId/routing', controller.confirmRouting);
router.get('/visits/:visitId/pathway', controller.pathway);
router.get('/visits/:visitId/results', controller.results);

module.exports = router;
