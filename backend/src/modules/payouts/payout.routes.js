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

/**
 * @swagger
 * /groups/{groupId}/payouts:
 *   get:
 *     summary: List all payouts for a group
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of payouts returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
// GET /groups/:groupId/payouts
router.get('/:groupId/payouts', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

/**
 * @swagger
 * /groups/{groupId}/payouts/current:
 *   get:
 *     summary: Get the current cycle's payout
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Current payout returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
// GET /groups/:groupId/payouts/current
router.get('/:groupId/payouts/current', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

/**
 * @swagger
 * /groups/{groupId}/payouts/nominate:
 *   post:
 *     summary: Nominate a member for the current payout (President only, President Decides mode)
 *     tags: [Payouts]
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
 *             required: [memberId]
 *             properties:
 *               memberId: { type: string }
 *               reason:   { type: string, example: "Member has an urgent medical need" }
 *     responses:
 *       201: { description: Member nominated for payout }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: A nominee already exists for this cycle }
 *       500: { description: Server error }
 */
// POST /groups/:groupId/payouts/nominate (President only — President Decides mode)
router.post('/:groupId/payouts/nominate', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

/**
 * @swagger
 * /groups/{groupId}/payouts/{id}/approve:
 *   post:
 *     summary: Approve a pending payout (President only)
 *     tags: [Payouts]
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
 *       200: { description: Payout approved }
 *       400: { description: Payout not in an approvable state }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
// POST /groups/:groupId/payouts/:id/approve (President)
router.post('/:groupId/payouts/:id/approve', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

/**
 * @swagger
 * /groups/{groupId}/payouts/{id}/execute:
 *   post:
 *     summary: Execute an approved payout disbursement (Treasurer only)
 *     tags: [Payouts]
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
 *       200: { description: Payout executed }
 *       400: { description: Payout not approved or eligibility check failed }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: Payout already executed }
 *       500: { description: Server error }
 */
// POST /groups/:groupId/payouts/:id/execute (Treasurer)
router.post('/:groupId/payouts/:id/execute', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev B Task B-04' });
});

module.exports = router;
