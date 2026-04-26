'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Members
 *   description: Group membership — invite, join, roles, removal
 */

// POST /groups/:groupId/invitations
router.post('/:groupId/invitations', auth, tenant, requireRole('president', 'secretary'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

// GET /invitations/:token (public — anyone with the link)
router.get('/invitations/:token', (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

// POST /invitations/:token/accept
router.post('/invitations/:token/accept', auth, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

// GET /groups/:groupId/members
router.get('/:groupId/members', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

// PATCH /groups/:groupId/members/:userId/role
router.patch('/:groupId/members/:userId/role', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

// DELETE /groups/:groupId/members/:userId
router.delete('/:groupId/members/:userId', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

module.exports = router;
