'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const ctrl = require('./payout.controller');

/**
 * @swagger
 * tags:
 *   name: Payouts
 *   description: 5-step payout engine — rotation, eligibility, approval, execution
 */

/**
 * @swagger
 * /groups/{groupId}/payouts:
 *   get:
 *     summary: List all payouts for a group (filterable by cycle/status)
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: cycleId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, processing, completed, failed, blocked] }
 *     responses:
 *       200: { description: List of payouts }
 */
router.get('/:groupId/payouts', auth, tenant, ctrl.listPayouts);

/**
 * @swagger
 * /groups/{groupId}/payouts/current:
 *   get:
 *     summary: Get current cycle's payout status and eligibility
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current payout status }
 */
router.get('/:groupId/payouts/current', auth, tenant, ctrl.getCurrentPayout);

/**
 * @swagger
 * /groups/{groupId}/payouts/determine-next-recipient:
 *   post:
 *     summary: Determine the next recipient for fixed/random rotation groups
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Next payout recipient created }
 */
router.post(
	'/:groupId/payouts/determine-next-recipient',
	auth,
	tenant,
	requireRole('president', 'treasurer'),
	ctrl.determineNextRecipient
);

/**
 * @swagger
 * /groups/{groupId}/payouts/nominate:
 *   post:
 *     summary: President nominates a recipient (president-decides rotation mode)
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientId]
 *             properties:
 *               recipientId: { type: string, format: uuid }
 *               deliveryMethod: { type: string, enum: [momo_mtn, momo_orange, campay, cash, bank] }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Payout nomination created }
 */
router.post('/:groupId/payouts/nominate', auth, tenant, requireRole('president'), ctrl.nominate);

/**
 * @swagger
 * /groups/{groupId}/payouts/{id}/approve:
 *   post:
 *     summary: President approves a pending payout
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Payout approved }
 *       400: { description: Collection threshold not met }
 */
router.post('/:groupId/payouts/:id/approve', auth, tenant, requireRole('president'), ctrl.approve);

/**
 * @swagger
 * /groups/{groupId}/payouts/{id}/execute:
 *   post:
 *     summary: Treasurer executes (disburses) an approved payout
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deliveryMethod: { type: string, enum: [momo_mtn, momo_orange, campay, cash, bank] }
 *     responses:
 *       200: { description: Payout executed }
 */
router.post('/:groupId/payouts/:id/execute', auth, tenant, requireRole('treasurer'), ctrl.execute);

module.exports = router;
