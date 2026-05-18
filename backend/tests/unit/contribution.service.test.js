'use strict';

/**
 * Unit tests for ContributionService.
 * All DB calls are mocked — these test business logic, not Supabase.
 */

// Mock supabase before requiring the module
const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };
jest.mock('../../src/config/supabase', () => ({ supabase: mockSupabase }));
jest.mock('../../src/services/payment/index', () => ({
  getProvider: jest.fn(),
}));

const ContributionService = require('../../src/modules/contributions/contribution.service');
const { getProvider } = require('../../src/services/payment/index');

// Helper to build chainable query mock
function mockQuery(returnData, returnError = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  // Non-single terminal
  chain.select.mockImplementation(() => {
    chain.then = (resolve) => resolve({ data: returnData, error: returnError });
    return chain;
  });
  return chain;
}

describe('ContributionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordCashPayment', () => {
    it('blocks treasurer from recording their own payment (anti-fraud)', async () => {
      // Audit log mock (fire-and-forget, should not throw)
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        from: jest.fn(),
      });

      await expect(
        ContributionService.recordCashPayment('g1', 'user-A', 'user-A', 50000, '')
      ).rejects.toThrow('Treasurer cannot record their own cash payment');
    });

    it('rejects if recorder === member (statusCode 403)', async () => {
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      try {
        await ContributionService.recordCashPayment('g1', 'same-user', 'same-user', 50000, '');
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FRAUD_SELF_PAYMENT');
      }
    });
  });

  describe('getMyContributions', () => {
    it('queries contributions filtered by group and user', async () => {
      const fakeContributions = [
        { id: 'c1', amount: 50000, status: 'confirmed' },
        { id: 'c2', amount: 50000, status: 'pending' },
      ];

      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: fakeContributions, error: null }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await ContributionService.getMyContributions('g1', 'u1');

      expect(result).toEqual(fakeContributions);
      expect(mockFrom).toHaveBeenCalledWith('contributions');
    });
  });

  describe('getStats', () => {
    it('returns zero stats when no active cycle', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await ContributionService.getStats('g1');
      expect(result.totalExpected).toBe(0);
      expect(result.totalCollected).toBe(0);
    });
  });
});

describe('Contribution Validation', () => {
  const { recordCashSchema, retryPaymentSchema } = require('../../src/modules/contributions/contribution.validation');

  it('recordCashSchema requires memberId and amount', () => {
    const { error } = recordCashSchema.validate({});
    expect(error).toBeTruthy();
    expect(error.details.length).toBeGreaterThanOrEqual(1);
  });

  it('recordCashSchema accepts valid input', () => {
    const { error } = recordCashSchema.validate({
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 50000,
    });
    expect(error).toBeUndefined();
  });

  it('recordCashSchema rejects negative amount', () => {
    const { error } = recordCashSchema.validate({
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      amount: -100,
    });
    expect(error).toBeTruthy();
  });

  it('retryPaymentSchema requires gateway', () => {
    const { error } = retryPaymentSchema.validate({});
    expect(error).toBeTruthy();
  });

  it('retryPaymentSchema rejects invalid gateway', () => {
    const { error } = retryPaymentSchema.validate({ gateway: 'paypal' });
    expect(error).toBeTruthy();
  });

  it('retryPaymentSchema accepts mtn_momo', () => {
    const { error } = retryPaymentSchema.validate({ gateway: 'mtn_momo' });
    expect(error).toBeUndefined();
  });
});
