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

module.exports = router;
