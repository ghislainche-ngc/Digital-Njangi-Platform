'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const FineService = require('./fine.service');
const { db } = require('../../config/supabase');
const { AuditService } = require('../../services/audit/AuditService');

const fineService = new FineService(db, new AuditService(db.getClient()));

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
router.get('/:groupId/fines', auth, tenant, async (req, res) => {
  try {
    const fines = await db.findAll('fines', { group_id: req.params.groupId });
    res.json(fines);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
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
router.get('/:groupId/fines/mine', auth, tenant, async (req, res) => {
  try {
    const fines = await fineService.getMemberUnpaidFines(req.params.groupId, req.user.sub);
    res.json(fines);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
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
router.post('/:groupId/fines', auth, tenant, requireRole('treasurer'), async (req, res) => {
  try {
    const { memberId, amount, reason } = req.body;
    const fine = await fineService.recordFine(
      req.params.groupId,
      memberId,
      amount,
      reason,
      req.user.sub
    );
    res.status(201).json(fine);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
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
 *               paymentMethod: { type: string, enum: [cash, momo], example: cash }
 *     responses:
 *       200: { description: Fine marked as paid }
 *       400: { description: Fine already paid or invalid state }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       404: { description: Fine not found }
 *       500: { description: Server error }
 */
router.patch('/:groupId/fines/:id/pay', auth, tenant, requireRole('treasurer'), async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const fine = await fineService.markPaid(req.params.id, req.user.sub, paymentMethod);
    res.json(fine);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: "Member had a valid emergency" }
 *     responses:
 *       200: { description: Fine waived }
 *       400: { description: A reason is required to waive a fine }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       404: { description: Fine not found }
 *       500: { description: Server error }
 */
// Waiver — President only
router.patch('/:groupId/fines/:id/waive', auth, tenant, requireRole('president'), async (req, res) => {
  try {
    const { reason } = req.body;
    const fine = await fineService.waiveFine(req.params.id, req.user.sub, reason);
    res.json(fine);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
});

module.exports = router;
