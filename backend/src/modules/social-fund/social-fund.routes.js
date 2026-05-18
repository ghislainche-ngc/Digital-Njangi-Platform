'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Social Fund
 *   description: Group social/welfare fund management
 */

/**
 * @swagger
 * /groups/{groupId}/social-fund:
 *   get:
 *     summary: Get the group's social fund balance and transaction history
 *     tags: [Social Fund]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Social fund balance and transactions returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/social-fund', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-04' });
});

/**
 * @swagger
 * /groups/{groupId}/social-fund/deposit:
 *   post:
 *     summary: Record a deposit into the social fund (Treasurer only)
 *     tags: [Social Fund]
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
 *             required: [amount, reason]
 *             properties:
 *               amount: { type: number, example: 5000 }
 *               reason: { type: string, example: "Monthly welfare contribution" }
 *     responses:
 *       201: { description: Deposit recorded }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
router.post('/:groupId/social-fund/deposit', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-04' });
});

/**
 * @swagger
 * /groups/{groupId}/social-fund/withdrawal:
 *   post:
 *     summary: Record a withdrawal from the social fund (Treasurer only)
 *     tags: [Social Fund]
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
 *             required: [amount, reason]
 *             properties:
 *               amount:    { type: number, example: 15000 }
 *               reason:    { type: string, example: "Bereavement support for a member" }
 *               recipient: { type: string, example: "Member name or ID" }
 *     responses:
 *       201: { description: Withdrawal recorded }
 *       400: { description: Validation error or insufficient fund balance }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
router.post('/:groupId/social-fund/withdrawal', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-04' });
});

module.exports = router;
