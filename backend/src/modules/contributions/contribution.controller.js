'use strict';

const contributionService = require('./contribution.service');
const {
  recordCashSchema,
  retryPaymentSchema,
  listContributionsSchema,
} = require('./contribution.validation');

/**
 * Contribution controller — thin handlers that validate input, delegate
 * to ContributionService, and send responses.
 *
 * OOP: Chain of Responsibility (Express middleware pipeline)
 *   auth → tenant → role → controller → service → DB
 */

const listContributions = async (req, res, next) => {
  try {
    const { error, value } = listContributionsSchema.validate(req.query);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await contributionService.listContributions(req.params.groupId, value);
    return res.json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const getMyContributions = async (req, res, next) => {
  try {
    const data = await contributionService.getMyContributions(
      req.params.groupId,
      req.user.sub
    );
    return res.json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const recordCash = async (req, res, next) => {
  try {
    const { error, value } = recordCashSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await contributionService.recordCashPayment(
      req.params.groupId,
      value.memberId,
      req.user.sub,
      value.amount,
      value.notes
    );
    return res.status(201).json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const initiateMobilePayment = async (req, res, next) => {
  try {
    const gateway = req.body.gateway;
    if (!['momo_mtn', 'momo_orange'].includes(gateway)) {
      return res.status(400).json({
        error: 'Gateway must be momo_mtn or momo_orange.',
        code: 'VALIDATION_ERROR',
      });
    }

    const data = await contributionService.initiateMobilePayment(
      req.params.groupId,
      req.user.sub,
      gateway
    );
    return res.status(202).json({ data, message: 'Payment initiated' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const retryPayment = async (req, res, next) => {
  try {
    const { error, value } = retryPaymentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await contributionService.retryPayment(
      req.params.groupId,
      req.params.id,
      value.gateway,
      req.user.sub
    );
    return res.status(202).json({ data, message: 'Retry initiated' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const data = await contributionService.getStats(req.params.groupId);
    return res.json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

module.exports = {
  listContributions,
  getMyContributions,
  recordCash,
  initiateMobilePayment,
  retryPayment,
  getStats,
};
