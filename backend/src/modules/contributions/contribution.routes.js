'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Contributions
 *   description: MoMo deductions, cash payments, contribution status
 */

// GET /groups/:groupId/contributions
router.get('/:groupId/contributions', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

// GET /groups/:groupId/contributions/mine
router.get('/:groupId/contributions/mine', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

// POST /groups/:groupId/contributions/cash (Treasurer only)
router.post('/:groupId/contributions/cash', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

// POST /groups/:groupId/contributions/:id/retry (Treasurer only)
router.post('/:groupId/contributions/:id/retry', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

module.exports = router;
