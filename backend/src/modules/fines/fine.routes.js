'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Fines
 *   description: Fine recording, payment, and waivers
 */

router.get('/:groupId/fines', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

router.get('/:groupId/fines/mine', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

router.post('/:groupId/fines', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

router.patch('/:groupId/fines/:id/pay', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

// Waiver — President only
router.patch('/:groupId/fines/:id/waive', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

module.exports = router;
