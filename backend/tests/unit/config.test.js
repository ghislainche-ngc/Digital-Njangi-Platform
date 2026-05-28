'use strict';

/**
 * Unit tests for environment configuration and Supabase client setup.
 *
 * @task Dev A — Task A-01
 */

describe('Environment validation (config/env.js)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars';
    process.env.APP_WEBHOOK_KEY = 'test-campay-webhook-key-32-bytes-min';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exports config when all required vars are present', () => {
    const config = require('../../src/config/env');
    expect(config.SUPABASE_URL).toBe('https://test.supabase.co');
    expect(config.SUPABASE_SERVICE_KEY).toBe('test-service-key');
    expect(config.JWT_SECRET).toBe('test-jwt-secret-at-least-32-chars');
  });

  it('throws when SUPABASE_URL is missing', () => {
    delete process.env.SUPABASE_URL;
    expect(() => require('../../src/config/env')).toThrow('SUPABASE_URL');
  });

  it('throws when SUPABASE_SERVICE_KEY is missing', () => {
    delete process.env.SUPABASE_SERVICE_KEY;
    expect(() => require('../../src/config/env')).toThrow('SUPABASE_SERVICE_KEY');
  });

  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => require('../../src/config/env')).toThrow('JWT_SECRET');
  });

  it('throws when APP_WEBHOOK_KEY is missing', () => {
    delete process.env.APP_WEBHOOK_KEY;
    expect(() => require('../../src/config/env')).toThrow('APP_WEBHOOK_KEY');
  });

  it('defaults PORT to 3000 when not set', () => {
    delete process.env.PORT;
    const config = require('../../src/config/env');
    expect(config.PORT).toBe(3000);
  });

  it('defaults NODE_ENV to development when not set', () => {
    delete process.env.NODE_ENV;
    const config = require('../../src/config/env');
    expect(config.NODE_ENV).toBe('development');
  });

  it('parses PORT as integer', () => {
    process.env.PORT = '4000';
    const config = require('../../src/config/env');
    expect(config.PORT).toBe(4000);
  });
});

describe('Supabase client (config/supabase.js)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  it('exports a supabase client object', () => {
    const { supabase } = require('../../src/config/supabase');
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('throws when env vars are missing', () => {
    delete process.env.SUPABASE_URL;
    expect(() => require('../../src/config/supabase')).toThrow('SUPABASE');
  });
});
