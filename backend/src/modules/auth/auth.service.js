'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabase } = require('../../config/supabase');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '24h';
const OTP_EXPIRY_MINUTES = 10;

class AuthService {
  async register({ email, phone, full_name, password, language = 'en' }) {
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

    const otpCode = await this._generateAndStoreOTP(phone);

    return {
      message: 'Registration successful. Check your phone for the OTP code.',
      userId: user.id,
      otpCode: process.env.NODE_ENV === 'development' ? otpCode : undefined,
    };
  }

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

    await supabase.from('otp_verifications').delete().eq('id', record.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, is_admin')
      .eq('phone', phone)
      .single();

    const token = this._signToken(user);
    const membership = await this._getPrimaryMembership(user.id);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.is_admin ? 'admin' : (membership?.role || 'member'),
        group_id: membership?.group_id || null,
      },
    };
  }

  async login({ email, password }) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, password_hash, is_admin')
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
    const membership = await this._getPrimaryMembership(user.id);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.is_admin ? 'admin' : (membership?.role || 'member'),
        group_id: membership?.group_id || null,
      },
    };
  }

  async _generateAndStoreOTP(phone) {
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabase.from('otp_verifications').delete().eq('phone', phone);

    const { error } = await supabase
      .from('otp_verifications')
      .insert({ phone, code, expires_at: expiresAt });

    if (error) throw error;
    return code;
  }

  _signToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  async _getPrimaryMembership(userId) {
    const { data } = await supabase
      .from('memberships')
      .select('group_id, role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return data || null;
  }
}

module.exports = new AuthService();
