'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { db } = require('../../config/supabase');
const SocialFundService = require('./social-fund.service');

const socialFundService = new SocialFundService(db);

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
 *     summary: Get the group's social fund balance
 *     tags: [Social Fund]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Social fund balance returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/social-fund', auth, tenant, async (req, res) => {
  try {
    const balance = await socialFundService.getBalance(req.params.groupId);
    res.status(200).json({ balance });
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message, code: 'SOCIAL_FUND_ERROR' });
  }
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
router.post(
  '/:groupId/social-fund/deposit',
  auth,
  tenant,
  requireRole('treasurer'),
  async (req, res) => {
    try {
      const { amount, reason } = req.body;
      const event = await socialFundService.recordDeposit(
        req.params.groupId,
        amount,
        reason,
        req.user.sub
      );
      res.status(201).json(event);
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message, code: 'SOCIAL_FUND_ERROR' });
    }
  }
);

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
 *               amount: { type: number, example: 15000 }
 *               reason: { type: string, example: "Bereavement support for a member" }
 *     responses:
 *       201: { description: Withdrawal recorded }
 *       400: { description: Validation error or insufficient fund balance }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
router.post(
  '/:groupId/social-fund/withdrawal',
  auth,
  tenant,
  requireRole('treasurer'),
  async (req, res) => {
    try {
      const { amount, reason } = req.body;
      const event = await socialFundService.recordWithdrawal(
        req.params.groupId,
        amount,
        reason,
        req.user.sub
      );
      res.status(201).json(event);
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message, code: 'SOCIAL_FUND_ERROR' });
    }
  }
);

/**
 * @swagger
 * /groups/{groupId}/social-fund/events:
 *   get:
 *     summary: Get the group's social fund transaction logs
 *     tags: [Social Fund]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of social fund events returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/social-fund/events', auth, tenant, async (req, res) => {
  try {
    const events = await socialFundService.getEvents(req.params.groupId);
    res.status(200).json(events);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message, code: 'SOCIAL_FUND_ERROR' });
  }
});

module.exports = router;
