'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./public.controller');

// Unauthenticated public route for landing page statistics
router.get('/stats', ctrl.getPublicStats);

module.exports = router;
