'use strict';

const PaymentProvider = require('../../src/services/payment/PaymentProvider');
const MTNMoMoService = require('../../src/services/payment/MTNMoMoService');
const OrangeMoneyService = require('../../src/services/payment/OrangeMoneyService');
const CampayService = require('../../src/services/payment/CampayService');
const { getProvider } = require('../../src/services/payment/index');

/**
 * Unit tests for PaymentProvider OOP hierarchy.
 * These tests verify the architecture — they do NOT call the real MoMo API.
 *
 * @task Dev D — Task D-01 (infrastructure) / Dev B verifies implementations
 */

describe('PaymentProvider (abstract class)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new PaymentProvider({})).toThrow('abstract');
  });
});

describe('MTNMoMoService', () => {
  it('extends PaymentProvider', () => {
    const service = new MTNMoMoService({ subscriptionKey: 'x', apiUser: 'y', apiKey: 'z' });
    expect(service).toBeInstanceOf(PaymentProvider);
  });
});

describe('OrangeMoneyService', () => {
  it('extends PaymentProvider', () => {
    const service = new OrangeMoneyService({ apiKey: 'x' });
    expect(service).toBeInstanceOf(PaymentProvider);
  });
});

describe('CampayService', () => {
  it('extends PaymentProvider', () => {
    const service = new CampayService({
      username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
    });
    expect(service).toBeInstanceOf(PaymentProvider);
  });

  it('normalizes a +237 phone to a 237-prefixed digit string', () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    expect(service._normalizePhone('+237677000001')).toBe('237677000001');
  });

  it('throws .statusCode=400 when _normalizePhone receives non-Cameroon input', () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    expect(() => service._normalizePhone('+233241234567'))
      .toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('masks the phone in the error message for privacy', () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    expect(() => service._normalizePhone('+233241234567'))
      .toThrow(expect.objectContaining({
        message: expect.stringContaining('+23324***'),
      }));
  });

  it('refund() throws — Campay has no native refund', async () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    await expect(service.refund('any-ref')).rejects.toThrow(/does not support native refunds/);
  });
});

describe('getProvider factory', () => {
  it('returns MTNMoMoService for mtn_momo', () => {
    const provider = getProvider('mtn_momo');
    expect(provider).toBeInstanceOf(MTNMoMoService);
  });

  it('returns OrangeMoneyService for orange_money', () => {
    const provider = getProvider('orange_money');
    expect(provider).toBeInstanceOf(OrangeMoneyService);
  });

  it('throws for unknown gateway', () => {
    expect(() => getProvider('paypal')).toThrow('Unknown payment gateway');
  });
});

describe('Payment factory — campay case', () => {
  it('returns a CampayService when env vars are set', () => {
    const original = { ...process.env };
    process.env.CAMPAY_APP_USERNAME = 'u';
    process.env.CAMPAY_APP_PASSWORD = 'p';
    try {
      jest.resetModules();
      const { getProvider: freshGetProvider } = require('../../src/services/payment/index');
      const provider = freshGetProvider('campay');
      expect(provider.constructor.name).toBe('CampayService');
    } finally {
      process.env = original;
      jest.resetModules();
    }
  });

  it('throws when CAMPAY_APP_USERNAME is unset', () => {
    const original = { ...process.env };
    delete process.env.CAMPAY_APP_USERNAME;
    delete process.env.CAMPAY_APP_PASSWORD;
    try {
      jest.resetModules();
      const { getProvider: freshGetProvider } = require('../../src/services/payment/index');
      expect(() => freshGetProvider('campay')).toThrow(/CAMPAY_APP_USERNAME/);
    } finally {
      process.env = original;
      jest.resetModules();
    }
  });
});
