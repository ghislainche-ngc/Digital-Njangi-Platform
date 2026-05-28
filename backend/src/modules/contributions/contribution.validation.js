'use strict';

const Joi = require('joi');

const recordCashSchema = Joi.object({
  memberId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'memberId must be a valid UUID' }),
  amount: Joi.number().positive().required()
    .messages({ 'number.positive': 'Amount must be a positive number' }),
  notes: Joi.string().max(255).allow('').optional(),
});

const retryPaymentSchema = Joi.object({
  gateway: Joi.string().valid('mtn_momo', 'orange_money', 'campay').required()
    .messages({ 'any.only': 'Gateway must be mtn_momo, orange_money, or campay' }),
});

const listContributionsSchema = Joi.object({
  cycleId: Joi.string().uuid().optional(),
  status: Joi.string().valid('pending', 'processing', 'confirmed', 'failed').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { recordCashSchema, retryPaymentSchema, listContributionsSchema };
