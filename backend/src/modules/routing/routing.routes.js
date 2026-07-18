const express = require('express');
const { optimizeSequence } = require('./routing.controller');

const router = express.Router();

router.post('/optimize-sequence', optimizeSequence);

module.exports = router;
