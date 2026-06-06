'use strict';

const payoutService = require('./payout.service');
const {
  nominateSchema,
  approveSchema,
  executeSchema,
  listPayoutsSchema,
} = require('./payout.validation');

/**
 * Payout controller — thin handlers that validate input, delegate
 * to PayoutService, and send responses.
 */

const listPayouts = async (req, res, next) => {
  try {
    const { error, value } = listPayoutsSchema.validate(req.query);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await payoutService.listPayouts(req.params.groupId, value);
    return res.json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const getCurrentPayout = async (req, res, next) => {
  try {
    const data = await payoutService.getCurrentPayout(req.params.groupId);
    return res.json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const determineNextRecipient = async (req, res, next) => {
  try {
    const data = await payoutService.determineNextRecipient(req.params.groupId);
    return res.status(201).json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const nominate = async (req, res, next) => {
  try {
    const { error, value } = nominateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await payoutService.nominate(
      req.params.groupId,
      value.recipientId,
      value.deliveryMethod,
      req.user.sub
    );
    return res.status(201).json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const approve = async (req, res, next) => {
  try {
    const { error } = approveSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await payoutService.approve(
      req.params.groupId,
      req.params.id,
      req.user.sub
    );
    return res.json({ data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const execute = async (req, res, next) => {
  try {
    const { error, value } = executeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const data = await payoutService.execute(
      req.params.groupId,
      req.params.id,
      req.user.sub,
      value.deliveryMethod
    );
    return res.json({ data, message: 'Payout executed' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

module.exports = { listPayouts, getCurrentPayout, determineNextRecipient, nominate, approve, execute };
