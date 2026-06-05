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

const pdfService = require('../../services/pdf/PDFService');
const { supabase } = require('../../config/supabase');

/**
 * @swagger
 * /groups/{groupId}/payouts/{id}/receipt:
 *   get:
 *     summary: Download a PDF receipt for a completed payout
 *     tags: [Payouts]
 *     security: [{ bearerAuth: [] }]
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
 *       200: { description: PDF receipt buffer returned }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.get('/:groupId/payouts/:id/receipt', auth, tenant, async (req, res, next) => {
  try {
    const { data: payout, error } = await supabase
      .from('payouts')
      .select('*, users!payouts_recipient_id_fkey(full_name, email), cycles(cycle_number), njangi_groups(name)')
      .eq('id', req.params.id)
      .eq('group_id', req.params.groupId)
      .single();

    if (error || !payout) {
      return res.status(404).json({ error: 'Payout not found', code: 'NOT_FOUND' });
    }

    // Access check: recipient themselves, Treasurer, or President
    if (
      req.user.role !== 'treasurer' &&
      req.user.role !== 'president' &&
      payout.recipient_id !== req.user.sub
    ) {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to view this receipt.',
        code: 'FORBIDDEN',
      });
    }

    const payoutData = {
      recipientName: payout.users?.full_name || payout.users?.email || 'Member',
      amount: payout.amount,
      method: payout.delivery_method || 'momo',
      date: payout.executed_at || payout.created_at,
      groupName: payout.njangi_groups?.name || 'Njangi Group',
      cycleNumber: payout.cycles?.cycle_number || 1,
      status: payout.status || 'completed',
    };

    const buffer = await pdfService.generatePayoutReceiptPDF(payoutData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payout-receipt-${req.params.id}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
