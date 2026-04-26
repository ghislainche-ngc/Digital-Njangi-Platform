'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { createGroup, getGroup, updateSettings } = require('./group.controller');

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Njangi group creation and management
 */

// POST /groups — create a new group
router.post('/', auth, createGroup);

// GET /groups/:groupId — get group details
router.get('/:groupId', auth, tenant, getGroup);

// PATCH /groups/:groupId — update settings (President only)
router.patch('/:groupId', auth, tenant, requireRole('president'), updateSettings);

module.exports = router;
