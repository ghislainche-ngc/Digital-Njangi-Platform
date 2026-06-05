'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabase } = require('../../config/supabase');
const { generateSecret, verify, generateURI } = require('otplib');

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

  async verifyOTP({ phone, code, ipAddress, userAgent }) {
    const { data: record } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!record) {
      const { data: user } = await supabase.from('users').select('id').eq('phone', phone).single();
      await this.logLoginAttempt({
        userId: user?.id || null,
        ipAddress,
        userAgent,
        status: 'failed',
        failureReason: 'Invalid or expired OTP code.'
      });

      const err = new Error('Invalid or expired OTP code.');
      err.statusCode = 400;
      err.code = 'INVALID_OTP';
      throw err;
    }

    await supabase.from('otp_verifications').delete().eq('id', record.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, is_admin, two_factor_enabled')
      .eq('phone', phone)
      .single();

    await this.logLoginAttempt({
      userId: user?.id || null,
      ipAddress,
      userAgent,
      status: 'success'
    });

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
        two_factor_enabled: !!user.two_factor_enabled,
      },
    };
  }

  async login({ email, password, ipAddress, userAgent }) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, password_hash, is_admin, two_factor_enabled')
      .eq('email', email)
      .single();

    if (!user) {
      await this.logLoginAttempt({
        userId: null,
        ipAddress,
        userAgent,
        status: 'failed',
        failureReason: 'User not found'
      });

      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await this.logLoginAttempt({
        userId: user.id,
        ipAddress,
        userAgent,
        status: 'failed',
        failureReason: 'Incorrect password'
      });

      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    if (user.two_factor_enabled) {
      const mfaToken = jwt.sign(
        { sub: user.id, email: user.email, mfa_pending: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return {
        status: '2fa_required',
        mfaToken
      };
    }

    await this.logLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      status: 'success'
    });

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
        two_factor_enabled: !!user.two_factor_enabled,
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
      { sub: user.id, email: user.email, is_admin: !!user.is_admin },
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

  /**
   * Upload a user's avatar image to Supabase Storage.
   */
  async uploadAvatar(userId, base64Image) {
    if (!base64Image) {
      const err = new Error('No image data provided.');
      err.statusCode = 400;
      err.code = 'MISSING_IMAGE';
      throw err;
    }

    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      const err = new Error('Invalid image format. Must be a base64 data URI.');
      err.statusCode = 400;
      err.code = 'INVALID_IMAGE_FORMAT';
      throw err;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 2 * 1024 * 1024) {
      const err = new Error('Image size exceeds 2MB limit.');
      err.statusCode = 400;
      err.code = 'FILE_TOO_LARGE';
      throw err;
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(mimeType)) {
      const err = new Error('Invalid image type. Allowed types: png, jpeg, webp.');
      err.statusCode = 400;
      err.code = 'INVALID_MIME_TYPE';
      throw err;
    }

    const fileName = `${userId}.png`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) throw error;

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
    return { avatarUrl: publicUrl };
  }

  async changePassword({ userId, oldPassword, newPassword }) {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const match = await bcrypt.compare(oldPassword, user.password_hash);
    if (!match) {
      const err = new Error('Invalid current password.');
      err.statusCode = 400;
      err.code = 'INVALID_CURRENT_PASSWORD';
      throw err;
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { message: 'Password changed successfully.' };
  }

  async generate2FASecret(userId) {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({ label: user.email, issuer: 'NjangiBridge', secret });

    return { secret, otpauthUrl };
  }

  async enable2FA({ userId, secret, code }) {
    const result = await verify({ token: code, secret, epochTolerance: 120 });
    if (!result || !result.valid) {
      const serverTime = new Date().toISOString();
      const err = new Error(`Invalid verification code. (Server time: ${serverTime}. Please sync your VPS clock if it is incorrect.)`);
      err.statusCode = 400;
      err.code = 'INVALID_MFA_CODE';
      throw err;
    }

    const { error } = await supabase
      .from('users')
      .update({ two_factor_secret: secret, two_factor_enabled: true })
      .eq('id', userId);

    if (error) throw error;

    return { message: '2FA enabled successfully.' };
  }

  async disable2FA(userId) {
    const { error } = await supabase
      .from('users')
      .update({ two_factor_secret: null, two_factor_enabled: false })
      .eq('id', userId);

    if (error) throw error;

    return { message: '2FA disabled successfully.' };
  }

  async verify2FALogin({ mfaToken, code, ipAddress, userAgent }) {
    let decoded;
    try {
      decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
    } catch (e) {
      const err = new Error('MFA session expired or invalid.');
      err.statusCode = 401;
      err.code = 'MFA_SESSION_EXPIRED';
      throw err;
    }

    if (!decoded.mfa_pending) {
      const err = new Error('Invalid MFA session.');
      err.statusCode = 400;
      err.code = 'INVALID_MFA_SESSION';
      throw err;
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, is_admin, two_factor_secret, two_factor_enabled')
      .eq('id', decoded.sub)
      .single();

    if (!user) {
      await this.logLoginAttempt({
        userId: null,
        ipAddress,
        userAgent,
        status: 'failed',
        failureReason: 'User not found during 2FA'
      });

      const err = new Error('User not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const result = await verify({ token: code, secret: user.two_factor_secret, epochTolerance: 120 });
    if (!result || !result.valid) {
      await this.logLoginAttempt({
        userId: user.id,
        ipAddress,
        userAgent,
        status: 'failed',
        failureReason: 'Invalid 2FA code'
      });

      const err = new Error('Invalid verification code.');
      err.statusCode = 400;
      err.code = 'INVALID_MFA_CODE';
      throw err;
    }

    await this.logLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      status: 'success'
    });

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
        two_factor_enabled: !!user.two_factor_enabled,
      },
    };
  }

  async logLoginAttempt({ userId, ipAddress, userAgent, status, failureReason }) {
    const { error } = await supabase
      .from('login_history')
      .insert({
        user_id: userId || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        status,
        failure_reason: failureReason || null,
      });

    if (error) {
      console.error('Failed to log login attempt:', error.message);
    }
  }

  async getLoginHistory(userId) {
    const { data, error } = await supabase
      .from('login_history')
      .select('id, ip_address, user_agent, status, failure_reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  }
}


module.exports = new AuthService();
