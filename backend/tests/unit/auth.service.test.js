'use strict';

const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.NODE_ENV = 'test';

jest.mock('../../src/config/supabase', () => {
  const mockFrom = jest.fn();
  const mockUpload = jest.fn().mockResolvedValue({ error: null });
  const mockStorageFrom = jest.fn().mockReturnValue({ upload: mockUpload });
  const mockStorage = { from: mockStorageFrom };
  return {
    supabase: { from: mockFrom, storage: mockStorage },
    __mockFrom: mockFrom,
    __mockUpload: mockUpload,
  };
});

jest.mock('otplib', () => {
  const mockSecret = 'mocked-secret-key';
  const mockCode = '123456';
  return {
    authenticator: {
      generateSecret: jest.fn().mockReturnValue(mockSecret),
      keyuri: jest.fn().mockReturnValue(`otpauth://totp/NjangiBridge:test%40naas.cm?secret=${mockSecret}`),
      verify: jest.fn().mockImplementation(({ token, secret }) => {
        return token === mockCode || token === '123456';
      }),
      generate: jest.fn().mockReturnValue(mockCode),
    }
  };
});

const { __mockFrom: mockFrom, __mockUpload: mockUpload } = require('../../src/config/supabase');
const authService = require('../../src/modules/auth/auth.service');

function chainMock(finalData = null, finalError = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.gt = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });

  const promise = Promise.resolve({ data: finalData, error: finalError });
  chain.then = promise.then.bind(promise);
  chain.catch = promise.catch.bind(promise);

  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthService.register', () => {
  it('creates user and returns success message (201)', async () => {
    const checkChain = chainMock(null);
    const insertChain = chainMock({ id: 'user-123', email: 'a@b.com', phone: '+237677000001' });
    const otpDeleteChain = chainMock();
    const otpInsertChain = chainMock(null, null);
    otpInsertChain.single = undefined;

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        callCount++;
        return callCount === 1 ? checkChain : insertChain;
      }
      if (table === 'otp_verifications') {
        callCount++;
        if (callCount <= 3) return otpDeleteChain;
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return chainMock();
    });

    const result = await authService.register({
      email: 'a@b.com',
      phone: '+237677000001',
      full_name: 'Alice',
      password: 'SecurePass123!',
    });

    expect(result.message).toContain('Registration successful');
    expect(result.userId).toBe('user-123');
  });

  it('throws 409 for duplicate email', async () => {
    const checkChain = chainMock({ id: 'existing-user' });
    mockFrom.mockReturnValue(checkChain);

    await expect(
      authService.register({
        email: 'duplicate@test.com',
        phone: '+237677000002',
        full_name: 'Bob',
        password: 'SecurePass123!',
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_USER' });
  });
});

describe('AuthService.login', () => {
  it('returns JWT token for valid credentials', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('CorrectPassword!', 4);

    const userChain = chainMock({
      id: 'user-456',
      email: 'test@naas.cm',
      full_name: 'Test User',
      password_hash: hash,
    });
    mockFrom.mockReturnValue(userChain);

    const result = await authService.login({
      email: 'test@naas.cm',
      password: 'CorrectPassword!',
    });

    expect(result.token).toBeDefined();
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded.sub).toBe('user-456');
    expect(decoded.email).toBe('test@naas.cm');
    expect(result.user.full_name).toBe('Test User');
  });

  it('throws 401 for wrong password', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('RealPassword', 4);

    const userChain = chainMock({
      id: 'user-456',
      email: 'test@naas.cm',
      full_name: 'Test',
      password_hash: hash,
    });
    mockFrom.mockReturnValue(userChain);

    await expect(
      authService.login({ email: 'test@naas.cm', password: 'WrongPassword' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws 401 for non-existent email', async () => {
    const userChain = chainMock(null);
    mockFrom.mockReturnValue(userChain);

    await expect(
      authService.login({ email: 'nobody@test.com', password: 'whatever' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });
});

describe('AuthService.verifyOTP', () => {
  it('returns JWT when OTP is valid', async () => {
    const otpChain = chainMock({ id: 'otp-1', phone: '+237677000001', code: '123456' });
    const deleteChain = chainMock();
    const userChain = chainMock({ id: 'user-789', email: 'otp@test.cm', full_name: 'OTP User' });

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'otp_verifications' && callCount === 1) return otpChain;
      if (table === 'otp_verifications') return deleteChain;
      if (table === 'users') return userChain;
      return chainMock();
    });

    const result = await authService.verifyOTP({ phone: '+237677000001', code: '123456' });

    expect(result.token).toBeDefined();
    expect(result.user.id).toBe('user-789');
  });

  it('throws 400 for expired OTP', async () => {
    const otpChain = chainMock(null);
    mockFrom.mockReturnValue(otpChain);

    await expect(
      authService.verifyOTP({ phone: '+237677000001', code: '999999' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_OTP' });
  });

  describe('uploadAvatar', () => {
    it('uploads base64 image successfully', async () => {
      mockUpload.mockResolvedValue({ error: null });
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await authService.uploadAvatar('user-123', base64Image);
      expect(result.avatarUrl).toContain('avatars/user-123.png');
      expect(mockUpload).toHaveBeenCalled();
    });

    it('throws 400 for missing image data', async () => {
      await expect(
        authService.uploadAvatar('user-123', null)
      ).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_IMAGE' });
    });

    it('throws 400 for invalid image format data url', async () => {
      await expect(
        authService.uploadAvatar('user-123', 'invalid-base64')
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_IMAGE_FORMAT' });
    });

    it('throws 400 for file too large (>2MB)', async () => {
      // Create a large mock base64 (e.g. 3MB)
      const largeBase64 = 'data:image/png;base64,' + 'a'.repeat(3 * 1024 * 1024);
      await expect(
        authService.uploadAvatar('user-123', largeBase64)
      ).rejects.toMatchObject({ statusCode: 400, code: 'FILE_TOO_LARGE' });
    });

    it('throws 400 for invalid mime type', async () => {
      const gifBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
      await expect(
        authService.uploadAvatar('user-123', gifBase64)
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MIME_TYPE' });
    });
  });
});

describe('AuthService.changePassword', () => {
  it('successfully updates password when current password matches', async () => {
    const bcrypt = require('bcrypt');
    const oldHash = await bcrypt.hash('OldSecurePassword!', 4);

    const userChain = chainMock({
      password_hash: oldHash,
    });
    const updateChain = chainMock();

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      return callCount === 1 ? userChain : updateChain;
    });

    const result = await authService.changePassword({
      userId: 'user-123',
      oldPassword: 'OldSecurePassword!',
      newPassword: 'NewSecurePassword!',
    });

    expect(result.message).toBe('Password changed successfully.');
  });

  it('throws 400 when current password does not match', async () => {
    const bcrypt = require('bcrypt');
    const oldHash = await bcrypt.hash('OldSecurePassword!', 4);

    const userChain = chainMock({
      password_hash: oldHash,
    });

    mockFrom.mockReturnValue(userChain);

    await expect(
      authService.changePassword({
        userId: 'user-123',
        oldPassword: 'WrongOldPassword',
        newPassword: 'NewSecurePassword!',
      })
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CURRENT_PASSWORD' });
  });
});

describe('AuthService 2FA operations', () => {
  it('generate2FASecret returns a secret and otpauthUrl', async () => {
    const userChain = chainMock({ email: 'test@naas.cm' });
    mockFrom.mockReturnValue(userChain);

    const result = await authService.generate2FASecret('user-123');
    expect(result.secret).toBeDefined();
    expect(result.otpauthUrl).toContain('otpauth://totp/NjangiBridge:test%40naas.cm');
  });

  it('enable2FA enables 2FA with valid code', async () => {
    const { authenticator } = require('otplib');
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);

    const updateChain = chainMock();
    mockFrom.mockReturnValue(updateChain);

    const result = await authService.enable2FA({
      userId: 'user-123',
      secret,
      code,
    });

    expect(result.message).toContain('enabled successfully');
  });

  it('enable2FA throws for invalid code', async () => {
    const { authenticator } = require('otplib');
    const secret = authenticator.generateSecret();

    await expect(
      authService.enable2FA({
        userId: 'user-123',
        secret,
        code: '000000',
      })
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MFA_CODE' });
  });

  it('disable2FA disables 2FA', async () => {
    const updateChain = chainMock();
    mockFrom.mockReturnValue(updateChain);

    const result = await authService.disable2FA('user-123');
    expect(result.message).toContain('disabled successfully');
  });

  it('login redirects to 2FA when enabled', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('Password123!', 4);

    const userChain = chainMock({
      id: 'user-123',
      email: 'test@naas.cm',
      full_name: 'Test User',
      password_hash: hash,
      two_factor_enabled: true,
    });
    mockFrom.mockReturnValue(userChain);

    const result = await authService.login({
      email: 'test@naas.cm',
      password: 'Password123!',
    });

    expect(result.status).toBe('2fa_required');
    expect(result.mfaToken).toBeDefined();
  });

  it('verify2FALogin logs in user with valid token and code', async () => {
    const { authenticator } = require('otplib');
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);

    const mfaToken = jwt.sign(
      { sub: 'user-123', email: 'test@naas.cm', mfa_pending: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const userChain = chainMock({
      id: 'user-123',
      email: 'test@naas.cm',
      full_name: 'Test User',
      two_factor_secret: secret,
    });
    mockFrom.mockReturnValue(userChain);

    const result = await authService.verify2FALogin({
      mfaToken,
      code,
    });

    expect(result.token).toBeDefined();
    expect(result.user.id).toBe('user-123');
  });
});

describe('AuthService Login History', () => {
  it('logLoginAttempt inserts into login_history table', async () => {
    const insertChain = chainMock(null);
    mockFrom.mockReturnValue(insertChain);

    await authService.logLoginAttempt({
      userId: 'user-123',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      status: 'success',
    });

    expect(mockFrom).toHaveBeenCalledWith('login_history');
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0',
      status: 'success',
      failure_reason: null,
    });
  });

  it('getLoginHistory retrieves records from login_history table', async () => {
    const records = [
      { id: '1', ip_address: '127.0.0.1', user_agent: 'Mozilla/5.0', status: 'success', created_at: new Date().toISOString() }
    ];
    const selectChain = chainMock(records);
    mockFrom.mockReturnValue(selectChain);

    const result = await authService.getLoginHistory('user-123');

    expect(mockFrom).toHaveBeenCalledWith('login_history');
    expect(selectChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result).toEqual(records);
  });
});



