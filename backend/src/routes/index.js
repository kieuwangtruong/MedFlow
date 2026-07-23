const express = require('express');
const adminRoutes = require('../modules/admin/admin.routes');
const aiGatewayRoutes = require('../modules/ai-gateway/ai-gateway.routes');
const authRoutes = require('../modules/auth/auth.routes');
const doctorRoutes = require('../modules/doctor/doctor.routes');
const healthRoutes = require('../modules/health/health.routes');
const patientRoutes = require('../modules/patient/patient.routes');
const routingRoutes = require('../modules/routing/routing.routes');
const symptomRoutingRoutes = require('../modules/symptom-routing/symptom-routing.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/ai', aiGatewayRoutes);
router.use('/doctor', doctorRoutes);
router.use('/admin', adminRoutes);
router.use('/routing', routingRoutes);
router.use('/symptom-routing', symptomRoutingRoutes);
router.use('/', patientRoutes);

module.exports = router;
