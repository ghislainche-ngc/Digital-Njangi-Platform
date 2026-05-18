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

/**
 * @swagger
 * /groups/{groupId}/fines:
 *   get:
 *     summary: List all fines for a group
 *     tags: [Fines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of fines returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/fines', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

/**
 * @swagger
 * /groups/{groupId}/fines/mine:
 *   get:
 *     summary: List the authenticated member's own fines
 *     tags: [Fines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of the member's fines returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/fines/mine', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

/**
 * @swagger
 * /groups/{groupId}/fines:
 *   post:
 *     summary: Record a new fine against a member (Treasurer only)
 *     tags: [Fines]
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
 *             required: [memberId, amount, reason]
 *             properties:
 *               memberId: { type: string }
 *               amount:   { type: number, example: 2000 }
 *               reason:   { type: string, example: "Late contribution" }
 *     responses:
 *       201: { description: Fine recorded }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
router.post('/:groupId/fines', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

/**
 * @swagger
 * /groups/{groupId}/fines/{id}/pay:
 *   patch:
 *     summary: Mark a fine as paid (Treasurer only)
 *     tags: [Fines]
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method: { type: string, enum: [cash, momo], example: cash }
 *               note:   { type: string, example: "Paid in cash at meeting" }
 *     responses:
 *       200: { description: Fine marked as paid }
 *       400: { description: Fine already paid or invalid state }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: Fine already settled }
 *       500: { description: Server error }
 */
router.patch('/:groupId/fines/:id/pay', auth, tenant, requireRole('treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

/**
 * @swagger
 * /groups/{groupId}/fines/{id}/waive:
 *   patch:
 *     summary: Waive a fine (President only)
 *     tags: [Fines]
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: "Member had a valid emergency" }
 *     responses:
 *       200: { description: Fine waived }
 *       400: { description: Fine already paid or invalid state }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: Fine already settled }
 *       500: { description: Server error }
 */
// Waiver — President only
router.patch('/:groupId/fines/:id/waive', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-03' });
});

module.exports = router;
