'use strict';

const authService = require('./auth.service');
const { registerSchema, loginSchema, otpVerifySchema, changePasswordSchema } = require('./auth.validation');


/**
 * Auth controller — route handlers only, no business logic.
 * Validates input → delegates to AuthService → sends response.
 *
 * @task Dev A — Task A-03
 */

const register = async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const result = await authService.register(value);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const verifyOTP = async (req, res, next) => {
  try {
    const { error, value } = otpVerifySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const result = await authService.verifyOTP(value);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const result = await authService.login(value);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    const { avatar } = req.body;
    const result = await authService.uploadAvatar(req.user.sub, avatar);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const getTelegramBotUrl = async (req, res, next) => {
  try {
    const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) return res.status(404).json({ error: 'Telegram bot not configured.' });
    
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    
    if (data.ok && data.result.username) {
      const username = data.result.username;
      const link = `https://t.me/${username}?start=${req.user.sub}`;
      return res.status(200).json({ link });
    }
    
    return res.status(500).json({ error: 'Failed to retrieve bot username.' });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const result = await authService.changePassword({
      userId: req.user.sub,
      oldPassword: value.oldPassword,
      newPassword: value.newPassword,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const generate2FA = async (req, res, next) => {
  try {
    const result = await authService.generate2FASecret(req.user.sub);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const enable2FA = async (req, res, next) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) {
      return res.status(400).json({ error: 'Secret and verification code are required.', code: 'VALIDATION_ERROR' });
    }
    const result = await authService.enable2FA({ userId: req.user.sub, secret, code });
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const disable2FA = async (req, res, next) => {
  try {
    const result = await authService.disable2FA(req.user.sub);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const verify2FALogin = async (req, res, next) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ error: 'MFA session token and verification code are required.', code: 'VALIDATION_ERROR' });
    }
    const result = await authService.verify2FALogin({ mfaToken, code });
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

module.exports = {
  register,
  verifyOTP,
  login,
  uploadAvatar,
  getTelegramBotUrl,
  changePassword,
  generate2FA,
  enable2FA,
  disable2FA,
  verify2FALogin,
};


