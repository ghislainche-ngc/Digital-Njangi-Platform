'use strict';

require('dotenv').config({ path: '.env.test' });

/**
 * Global test helpers — available in every test file without imports.
 *
 * @task Dev D — Task D-01
 */
global.testUser = {
  email: 'test@naas.cm',
  phone: '+237600000001',
  full_name: 'Test User',
  password: 'TestPassword123!',
  language: 'en',
};

global.testGroup = {
  name: 'Test Njangi Group',
  contribution_amount: 10000,
  frequency: 'monthly',
  rotation_type: 'fixed',
  penalty_per_day: 500,
};

// Console suppression is handled per-test file where needed.
// This file runs via setupFiles (before test framework), so
// beforeEach/afterEach are not available here.

jest.mock('otplib', () => {
  const mockSecret = 'mocked-secret-key';
  const mockCode = '123456';
  const mockAuthenticator = {
    generateSecret: jest.fn().mockReturnValue(mockSecret),
    keyuri: jest.fn().mockReturnValue(`otpauth://totp/NjangiBridge:test%40naas.cm?secret=${mockSecret}`),
    verify: jest.fn().mockImplementation(({ token, secret }) => {
      return token === mockCode || token === '123456';
    }),
    generate: jest.fn().mockReturnValue(mockCode),
  };
  return {
    authenticator: mockAuthenticator,
    generateSecret: mockAuthenticator.generateSecret,
    generateURI: jest.fn().mockReturnValue(`otpauth://totp/NjangiBridge:test%40naas.cm?secret=${mockSecret}&issuer=NjangiBridge`),
    verify: jest.fn().mockImplementation(({ token, secret }) => {
      return Promise.resolve({ valid: token === mockCode || token === '123456' });
    }),
    generate: jest.fn().mockResolvedValue(mockCode),
  };
});

