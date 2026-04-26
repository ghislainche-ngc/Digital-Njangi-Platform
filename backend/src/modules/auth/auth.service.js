'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase } = require('../../config/supabase');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '24h';

/**
 * AuthService — all authentication business logic lives here.
 * Controllers are thin wrappers that call these methods.
 *
 * @task Dev A — Task A-03
 */
class AuthService {
  /**
   * Register a new user. Hashes password, stores in DB, sends OTP via SMS.
   * @returns {{ message: string }} — does NOT return the JWT until OTP verified
   */
  async register({ email, phone, full_name, password, language = 'en' }) {
    // Check for existing email or phone
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},phone.eq.${phone}`)
      .single();

    if (existing) {
      const err = new Error('Email or phone already registered.');
      err.statusCode = 409;
      err.code = 'DUPLICATE_USER';
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, phone, full_name, language, password_hash: passwordHash })
      .select()
      .single();

    if (error) throw error;

    // TODO (Dev A): trigger SMS OTP via NotificationService
    // await notificationService.sendOTP(phone);

    return { message: 'Registration successful. Check your phone for the OTP code.', userId: user.id };
  }

  /**
   * Verify a 6-digit OTP and issue JWT.
   * @returns {{ token: string, user: object }}
   */
  async verifyOTP({ phone, code }) {
    const { data: record } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!record) {
      const err = new Error('Invalid or expired OTP code.');
      err.statusCode = 400;
      err.code = 'INVALID_OTP';
      throw err;
    }

    // Invalidate used OTP
    await supabase.from('otp_verifications').delete().eq('id', record.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('phone', phone)
      .single();

    const token = this._signToken(user);
    return { token, user };
  }

  /**
   * Log in with email + password. Returns JWT.
   * @returns {{ token: string, user: object }}
   */
  async login({ email, password }) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, password_hash')
      .eq('email', email)
      .single();

    if (!user) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const token = this._signToken(user);
    return { token, user: { id: user.id, email: user.email, full_name: user.full_name } };
  }

  /**
   * Signs a JWT with standard NAAS payload.
   * @param {object} user
   * @returns {string}
   */
  _signToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }
}

module.exports = new AuthService();
