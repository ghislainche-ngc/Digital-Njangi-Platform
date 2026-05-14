'use strict';

/**
 * Unit tests for PayoutService.
 * All DB calls are mocked — these test business logic and validation.
 */

const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };
jest.mock('../../src/config/supabase', () => ({ supabase: mockSupabase }));
jest.mock('../../src/services/payment/index', () => ({
  getProvider: jest.fn(),
}));

const PayoutService = require('../../src/modules/payouts/payout.service');
const { getProvider } = require('../../src/services/payment/index');

describe('PayoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('approve', () => {
    it('rejects approval of non-pending payout', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'p1', status: 'completed', cycle_id: 'c1' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      try {
        await PayoutService.approve('g1', 'p1', 'president-user');
        fail('Should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('INVALID_STATUS');
      }
    });

    it('rejects if payout not found', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };
      mockFrom.mockReturnValue(chain);

      try {
        await PayoutService.approve('g1', 'nonexistent', 'president-user');
        fail('Should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('execute', () => {
    it('rejects execution of non-approved payout', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'p1', status: 'pending', users: { phone: '+237677000001' } },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      try {
        await PayoutService.execute('g1', 'p1', 'treasurer-user');
        fail('Should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('INVALID_STATUS');
        expect(err.message).toContain('Must be approved first');
      }
    });
  });

  describe('getCurrentPayout', () => {
    it('returns message when no active cycle', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await PayoutService.getCurrentPayout('g1');
      expect(result.message).toBe('No active cycle');
      expect(result.payout).toBeNull();
    });
  });
});

describe('Payout Validation', () => {
  const {
    nominateSchema,
    approveSchema,
    executeSchema,
    listPayoutsSchema,
  } = require('../../src/modules/payouts/payout.validation');

  it('nominateSchema requires recipientId', () => {
    const { error } = nominateSchema.validate({});
    expect(error).toBeTruthy();
  });

  it('nominateSchema accepts valid input', () => {
    const { error } = nominateSchema.validate({
      recipientId: '550e8400-e29b-41d4-a716-446655440000',
      deliveryMethod: 'momo_mtn',
    });
    expect(error).toBeUndefined();
  });

  it('nominateSchema rejects invalid delivery method', () => {
    const { error } = nominateSchema.validate({
      recipientId: '550e8400-e29b-41d4-a716-446655440000',
      deliveryMethod: 'paypal',
    });
    expect(error).toBeTruthy();
  });

  it('approveSchema accepts empty body', () => {
    const { error } = approveSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('executeSchema accepts empty body', () => {
    const { error } = executeSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('executeSchema accepts valid delivery method', () => {
    const { error } = executeSchema.validate({ deliveryMethod: 'cash' });
    expect(error).toBeUndefined();
  });

  it('listPayoutsSchema sets defaults', () => {
    const { value } = listPayoutsSchema.validate({});
    expect(value.page).toBe(1);
    expect(value.limit).toBe(20);
  });

  it('listPayoutsSchema rejects invalid status', () => {
    const { error } = listPayoutsSchema.validate({ status: 'invalid' });
    expect(error).toBeTruthy();
  });
});
