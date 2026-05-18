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

/**
 * @swagger
 * /groups/{groupId}/contributions:
 *   get:
 *     summary: List all contributions for a group
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of contributions returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
// GET /groups/:groupId/contributions
router.get('/:groupId/contributions', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

/**
 * @swagger
 * /groups/{groupId}/contributions/mine:
 *   get:
 *     summary: List the authenticated member's own contributions
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of the member's contributions returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
// GET /groups/:groupId/contributions/mine
router.get('/:groupId/contributions/mine', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

/**
 * @swagger
 * /groups/{groupId}/contributions/cash:
 *   post:
 *     summary: Record a cash contribution (Treasurer only)
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, amount]
 *             properties:
 *               memberId: { type: string }
 *               amount:   { type: number, example: 10000 }
 *               note:     { type: string, example: "Cash paid at weekly meeting" }
 *     responses:
 *       201: { description: Cash contribution recorded }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: Contribution already recorded for this cycle }
 *       500: { description: Server error }
 */
// POST /groups/:groupId/contributions/cash (Treasurer only)
router.post('/:groupId/contributions/cash', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

/**
 * @swagger
 * /groups/{groupId}/contributions/{id}/retry:
 *   post:
 *     summary: Retry a failed MoMo contribution deduction (Treasurer only)
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Retry initiated }
 *       400: { description: Contribution not in a retryable state }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
// POST /groups/:groupId/contributions/:id/retry (Treasurer only)
router.post('/:groupId/contributions/:id/retry', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-02' });
});

module.exports = router;
