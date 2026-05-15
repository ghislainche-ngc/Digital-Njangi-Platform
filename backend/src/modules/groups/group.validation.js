'use strict';

const Joi = require('joi');

const createGroupSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  contribution_amount: Joi.number().positive().required(),
  frequency: Joi.string().valid('weekly', 'monthly').default('monthly'),
  rotation_type: Joi.string().valid('fixed', 'random', 'president').required(),
  penalty_per_day: Joi.number().min(0).default(0),
  payout_threshold_pct: Joi.number().min(0).max(100).default(100),
  approval_threshold: Joi.number().min(0).default(0),
});

const updateGroupSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  contribution_amount: Joi.number().positive(),
  frequency: Joi.string().valid('weekly', 'monthly'),
  rotation_type: Joi.string().valid('fixed', 'random', 'president'),
  penalty_per_day: Joi.number().min(0),
  payout_threshold_pct: Joi.number().min(0).max(100),
  approval_threshold: Joi.number().min(0),
}).min(1);

module.exports = { createGroupSchema, updateGroupSchema };
