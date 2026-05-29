'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth.middleware');
const requireAdmin = require('../../middleware/admin.middleware');
const ctrl = require('./admin.controller');

// Protect all routes with auth and admin verification
router.use(auth);
router.use(requireAdmin);

router.get('/stats', ctrl.getPlatformStats);
router.get('/groups', ctrl.getPlatformGroups);
router.patch('/groups/:groupId/subscription', ctrl.updateGroupSubscription);
router.patch('/groups/:groupId/status', ctrl.updateGroupStatus);
router.get('/transactions', ctrl.getGlobalTransactions);

module.exports = router;
