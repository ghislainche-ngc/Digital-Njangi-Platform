'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Ledger, summaries, personal history, PDF export
 */

router.get('/:groupId/reports/ledger', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

router.get('/:groupId/reports/summary', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

router.get('/:groupId/reports/my-history', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

// PDF export — President and Treasurer only
router.post('/:groupId/reports/export', auth, tenant, requireRole('president', 'treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

module.exports = router;
