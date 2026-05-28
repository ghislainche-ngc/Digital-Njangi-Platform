'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const ctrl = require('./contribution.controller');

/**
 * @swagger
 * tags:
 *   name: Contributions
 *   description: MoMo deductions, cash payments, contribution tracking
 */

/**
 * @swagger
 * /groups/{groupId}/contributions:
 *   get:
 *     summary: List all contributions for a group (filterable by cycle/status)
 *     tags: [Contributions]
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
 *         schema: { type: string, enum: [pending, processing, confirmed, failed] }
 *     responses:
 *       200: { description: List of contributions }
 */
router.get('/:groupId/contributions', auth, tenant, ctrl.listContributions);

/**
 * @swagger
 * /groups/{groupId}/contributions/mine:
 *   get:
 *     summary: Get the authenticated member's own contributions
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member's contribution history }
 */
router.get('/:groupId/contributions/mine', auth, tenant, ctrl.getMyContributions);

/**
 * @swagger
 * /groups/{groupId}/contributions/stats:
 *   get:
 *     summary: Get contribution statistics for the current cycle
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Contribution statistics }
 */
router.get('/:groupId/contributions/stats', auth, tenant, ctrl.getStats);

/**
 * @swagger
 * /groups/{groupId}/contributions/pay:
 *   post:
 *     summary: Initiate a MoMo/Orange money deduction for your contribution
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gateway]
 *             properties:
 *               gateway: { type: string, enum: [momo_mtn, momo_orange, campay] }
 *     responses:
 *       202: { description: Payment initiated }
 */
router.post('/:groupId/contributions/pay', auth, tenant, ctrl.initiateMobilePayment);

/**
 * @swagger
 * /groups/{groupId}/contributions/cash:
 *   post:
 *     summary: Record a cash payment (Treasurer only)
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, amount]
 *             properties:
 *               memberId: { type: string, format: uuid }
 *               amount: { type: number }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Cash payment recorded }
 *       403: { description: Fraud alert — self-payment blocked }
 */
router.post('/:groupId/contributions/cash', auth, tenant, requireRole('treasurer'), ctrl.recordCash);

/**
 * @swagger
 * /groups/{groupId}/contributions/{id}/retry:
 *   post:
 *     summary: Retry a failed MoMo/Orange payment (Treasurer only)
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gateway]
 *             properties:
 *               gateway: { type: string, enum: [mtn_momo, orange_money, campay] }
 *     responses:
 *       202: { description: Retry initiated }
 */
router.post('/:groupId/contributions/:id/retry', auth, tenant, requireRole('treasurer'), ctrl.retryPayment);

const pdfService = require('../../services/pdf/PDFService');
const { supabase } = require('../../config/supabase');

/**
 * @swagger
 * /groups/{groupId}/contributions/{id}/receipt:
 *   get:
 *     summary: Download a PDF receipt for a contribution
 *     tags: [Contributions]
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
router.get('/:groupId/contributions/:id/receipt', auth, tenant, async (req, res, next) => {
  try {
    const { data: contribution, error } = await supabase
      .from('contributions')
      .select('*, users!contributions_user_id_fkey(full_name, email), cycles(cycle_number), njangi_groups(name)')
      .eq('id', req.params.id)
      .eq('group_id', req.params.groupId)
      .single();

    if (error || !contribution) {
      return res.status(404).json({ error: 'Contribution not found', code: 'NOT_FOUND' });
    }

    // Role check: only the contributor themselves, or Treasurer/President of the group
    if (
      req.user.role !== 'treasurer' &&
      req.user.role !== 'president' &&
      contribution.user_id !== req.user.sub
    ) {
      return res.status(403).json({
        error: 'Access denied. You do not have permission to view this receipt.',
        code: 'FORBIDDEN',
      });
    }

    const receiptData = {
      memberName: contribution.users?.full_name || contribution.users?.email || 'Member',
      amount: contribution.amount,
      method: contribution.payment_method || 'momo',
      date: contribution.confirmed_at || contribution.created_at,
      groupName: contribution.njangi_groups?.name || 'Njangi Group',
      cycleNumber: contribution.cycles?.cycle_number || 1,
    };

    const buffer = await pdfService.generateReceiptPDF(receiptData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${req.params.id}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
