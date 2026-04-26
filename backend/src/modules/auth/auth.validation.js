'use strict';

const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+[1-9]\d{6,14}$/).required()
    .messages({ 'string.pattern.base': 'Phone must be in E.164 format, e.g. +237677000001' }),
  full_name: Joi.string().min(2).max(100).required(),
  password: Joi.string().min(8).required()
    .messages({ 'string.min': 'Password must be at least 8 characters' }),
  language: Joi.string().valid('en', 'fr').default('en'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const otpVerifySchema = Joi.object({
  phone: Joi.string().required(),
  code: Joi.string().length(6).required(),
});

module.exports = { registerSchema, loginSchema, otpVerifySchema };
