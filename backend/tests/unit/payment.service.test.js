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

  describe('_getToken token caching', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({
        username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'tok-abc', expires_in: 3600 }),
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('fetches a token on first call', async () => {
      const tok = await service._getToken();
      expect(tok).toBe('tok-abc');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://demo.campay.net/api/token/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'u', password: 'p' }),
        })
      );
    });

    it('reuses the cached token on subsequent calls within expiry', async () => {
      await service._getToken();
      await service._getToken();
      await service._getToken();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('refetches when the cached token is within 5 minutes of expiry', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-23T12:00:00Z'));
      await service._getToken();
      // Advance 55 minutes — still in the "5 min before expiry" refresh window.
      jest.setSystemTime(new Date('2026-05-23T12:55:01Z'));
      await service._getToken();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('throws .statusCode=502 when /token/ returns an error response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 401, text: async () => 'invalid credentials',
      });
      await expect(service._getToken()).rejects.toThrow(expect.objectContaining({
        statusCode: 502,
        message: expect.stringContaining('Campay token request failed'),
      }));
    });
  });

  describe('charge', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({
        username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
      });
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
      jest.useRealTimers();
    });

    function mockToken() {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
    }
    function mockCollect(reference = 'campay-ref-1') {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ reference, ussd_code: '*126#', operator: 'mtn' }),
      });
    }
    function mockStatus(status, extras = {}) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reference: 'campay-ref-1', status, ...extras }),
      });
    }

    it('happy path: charge resolves to SUCCESSFUL', async () => {
      mockToken();
      mockCollect('campay-ref-1');
      mockStatus('SUCCESSFUL', { operator: 'MTN', operator_reference: '00X' });

      const result = await service.charge('+237677000001', 5000, 'contrib-uuid-1');

      expect(result).toEqual(expect.objectContaining({
        success: true,
        externalRef: 'campay-ref-1',
        status: 'SUCCESSFUL',
      }));

      const collectCall = fetchSpy.mock.calls[1];
      expect(collectCall[0]).toBe('https://demo.campay.net/api/collect/');
      const body = JSON.parse(collectCall[1].body);
      expect(body).toEqual({
        amount: '5000',
        currency: 'XAF',
        from: '237677000001',
        description: expect.any(String),
        external_reference: 'contrib-uuid-1',
      });
      expect(collectCall[1].headers.Authorization).toBe('Token tok');
    });

    it('failed status maps to FAILED, success=false, no throw', async () => {
      mockToken();
      mockCollect();
      mockStatus('FAILED', { reason: 'Insufficient funds' });

      const result = await service.charge('+237677000001', 100, 'contrib-uuid-2');
      expect(result).toEqual(expect.objectContaining({
        success: false, status: 'FAILED',
      }));
    });

    it('TIMEOUT when polling never resolves within 30s', async () => {
      jest.useFakeTimers();
      mockToken();
      mockCollect();
      fetchSpy.mockResolvedValue({
        ok: true, json: async () => ({ reference: 'campay-ref-1', status: 'PENDING' }),
      });

      const promise = service.charge('+237677000001', 5000, 'contrib-uuid-3');
      await jest.advanceTimersByTimeAsync(31_000);

      const result = await promise;
      expect(result).toEqual(expect.objectContaining({
        success: false, status: 'TIMEOUT', externalRef: 'campay-ref-1',
      }));
    });

    it('throws .statusCode=502 when /collect/ returns 4xx', async () => {
      mockToken();
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 400, text: async () => '{"error":"bad amount"}',
      });
      await expect(service.charge('+237677000001', 0, 'contrib-uuid-4'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 502 }));
    });

    it('throws .statusCode=400 (without calling fetch) for non-Cameroon phone', async () => {
      await expect(service.charge('+233241234567', 5000, 'contrib-uuid-5'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('disburse', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({
        username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
      });
      fetchSpy = jest.spyOn(global, 'fetch');
    });
    afterEach(() => { fetchSpy.mockRestore(); });

    it('happy path: disburse resolves to SUCCESSFUL via /withdraw/', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ reference: 'wd-ref-1', status: 'PENDING' }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ reference: 'wd-ref-1', status: 'SUCCESSFUL' }),
      });

      const result = await service.disburse('+237677000001', 2500, 'payout-uuid-1');
      expect(result).toEqual(expect.objectContaining({
        success: true, externalRef: 'wd-ref-1', status: 'SUCCESSFUL',
      }));

      const withdrawCall = fetchSpy.mock.calls[1];
      expect(withdrawCall[0]).toBe('https://demo.campay.net/api/withdraw/');
      const body = JSON.parse(withdrawCall[1].body);
      expect(body).toEqual({
        amount: '2500',
        to: '237677000001',
        description: expect.any(String),
        external_reference: 'payout-uuid-1',
      });
    });

    it('throws .statusCode=502 when /withdraw/ returns 4xx', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 403,
        text: async () => '{"error":"withdrawals not enabled"}',
      });
      await expect(service.disburse('+237677000001', 100, 'payout-uuid-2'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 502 }));
    });

    it('throws .statusCode=400 (without calling fetch) for non-Cameroon phone', async () => {
      await expect(service.disburse('+233241234567', 100, 'payout-uuid-3'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({ username: 'u', password: 'p' });
      fetchSpy = jest.spyOn(global, 'fetch');
    });
    afterEach(() => { fetchSpy.mockRestore(); });

    it('returns the status from a single /transaction/<ref>/ call', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reference: 'r-1', status: 'SUCCESSFUL', amount: 5 }),
      });

      const status = await service.getStatus('r-1');
      expect(status).toBe('SUCCESSFUL');
      expect(fetchSpy.mock.calls[1][0]).toBe('https://demo.campay.net/api/transaction/r-1/');
    });

    it('throws .statusCode=502 on upstream error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 404, text: async () => 'not found',
      });
      await expect(service.getStatus('r-1'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 502 }));
    });
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
    process.env.APP_USERNAME = 'u';
    process.env.APP_PASSWORD = 'p';
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

  it('throws when APP_USERNAME is unset', () => {
    const original = { ...process.env };
    delete process.env.APP_USERNAME;
    delete process.env.APP_PASSWORD;
    try {
      jest.resetModules();
      const { getProvider: freshGetProvider } = require('../../src/services/payment/index');
      expect(() => freshGetProvider('campay')).toThrow(/APP_USERNAME/);
    } finally {
      process.env = original;
      jest.resetModules();
    }
  });
});
