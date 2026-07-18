const express = require('express');
const { routeSymptoms } = require('./symptom-routing.controller');

const router = express.Router();

router.post('/', routeSymptoms);

module.exports = router;
