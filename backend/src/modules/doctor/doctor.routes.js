const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const controller = require('./doctor.controller');

const router = express.Router();
router.use(authenticate, authorize('DOCTOR', 'ADMIN'));
router.get('/assignment', controller.assignment);
router.get('/queue', controller.queue);
router.post('/intake', controller.intake);
router.get('/visits/:visitId', controller.visit);
router.patch('/visits/:visitId/priority', controller.updatePriority);
router.post('/visits/:visitId/call', controller.callVisit);
router.post('/visits/:visitId/start', controller.startVisit);
router.post('/visits/:visitId/orders', controller.createOrder);
router.post('/visits/:visitId/complete', controller.completeVisit);
router.post('/visits/:visitId/results/validate', controller.validateResult);
router.post('/visits/:visitId/orders/:taskId/complete', controller.completeOrder);
router.post('/visits/:visitId/complete-order', controller.completeOrder);

module.exports = router;
