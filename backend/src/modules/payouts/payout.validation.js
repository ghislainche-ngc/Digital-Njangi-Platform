'use strict';

const Joi = require('joi');

const nominateSchema = Joi.object({
  recipientId: Joi.string().uuid().required()
    .messages({ 'string.guid': 'recipientId must be a valid UUID' }),
  deliveryMethod: Joi.string().valid('momo_mtn', 'momo_orange', 'cash', 'bank').default('momo_mtn'),
  notes: Joi.string().max(255).allow('').optional(),
});

const approveSchema = Joi.object({
  notes: Joi.string().max(255).allow('').optional(),
});

const executeSchema = Joi.object({
  deliveryMethod: Joi.string().valid('momo_mtn', 'momo_orange', 'cash', 'bank').optional(),
});

const listPayoutsSchema = Joi.object({
  cycleId: Joi.string().uuid().optional(),
  status: Joi.string().valid('pending', 'approved', 'processing', 'completed', 'failed', 'blocked').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { nominateSchema, approveSchema, executeSchema, listPayoutsSchema };
