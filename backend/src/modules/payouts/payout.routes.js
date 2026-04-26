'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Payouts
 *   description: 5-step payout engine with eligibility checks
 */

// GET /groups/:groupId/payouts
router.get('/:groupId/payouts', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

// GET /groups/:groupId/payouts/current
router.get('/:groupId/payouts/current', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

// POST /groups/:groupId/payouts/nominate (President only — President Decides mode)
router.post('/:groupId/payouts/nominate', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

// POST /groups/:groupId/payouts/:id/approve (President)
router.post('/:groupId/payouts/:id/approve', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

// POST /groups/:groupId/payouts/:id/execute (Treasurer)
router.post('/:groupId/payouts/:id/execute', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

module.exports = router;
