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

router.get('/:groupId/fines', auth, tenant, async (req, res) => {
  try {
    const fines = await db.findAll('fines', { group_id: req.params.groupId });
    res.json(fines);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
});

router.get('/:groupId/fines/mine', auth, tenant, async (req, res) => {
  try {
    const fines = await fineService.getMemberUnpaidFines(req.params.groupId, req.user.sub);
    res.json(fines);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
});

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

router.patch('/:groupId/fines/:id/pay', auth, tenant, requireRole('treasurer'), async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const fine = await fineService.markPaid(req.params.id, req.user.sub, paymentMethod);
    res.json(fine);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'FINE_ERROR' });
  }
});

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
