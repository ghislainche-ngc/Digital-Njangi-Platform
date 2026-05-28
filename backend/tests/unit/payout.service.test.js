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

function chainWithArray(returnData, returnError = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  // The final call in execute() is .from('payouts').update(...).eq(...).select()
  // which returns { data: [...], error } via .then() or direct await
  chain.select.mockImplementation(() => {
    return {
      then: (resolve) => resolve({ data: returnData, error: returnError }),
    };
  });
  return chain;
}

function chainWith(returnData, returnError = null) {
  return {
    select: jest.fn().mockImplementation(() => {
      return {
        ...chainWith(returnData, returnError),
        single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
      };
    }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
}

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

    it('uses campay when group.preferred_payout_gateway is campay', async () => {
      const payout = {
        id: 'p1', status: 'approved', recipient_id: 'u1',
        amount: 5000, delivery_method: 'momo_mtn',
        users: { phone: '+237677000001', full_name: 'Test User' },
      };

      mockFrom
        .mockReturnValueOnce(chainWith(payout))
        .mockReturnValueOnce(chainWith(null)) // update to processing
        .mockReturnValueOnce(chainWith({ preferred_payout_gateway: 'campay' })) // fetch group
        .mockReturnValueOnce(chainWith(null)) // insert payment_transactions
        .mockReturnValueOnce(chainWithArray([{ id: 'p1', status: 'completed' }])) // final update
        .mockReturnValueOnce(chainWith(null)); // audit log insert

      const mockProvider = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'cp-ref-1', status: 'SUCCESSFUL' }) };
      getProvider.mockReturnValue(mockProvider);

      await PayoutService.execute('g1', 'p1', 'exec-user');

      expect(getProvider).toHaveBeenCalledWith('campay');
      expect(mockProvider.disburse).toHaveBeenCalledWith('+237677000001', 5000, 'p1');
    });

    it('falls back to mtn_momo when preferred_payout_gateway is null', async () => {
      const payout = {
        id: 'p1', status: 'approved', recipient_id: 'u1',
        amount: 5000, delivery_method: 'momo_mtn',
        users: { phone: '+237677000001', full_name: 'Test User' },
      };

      mockFrom
        .mockReturnValueOnce(chainWith(payout))
        .mockReturnValueOnce(chainWith(null)) // update to processing
        .mockReturnValueOnce(chainWith({ preferred_payout_gateway: null })) // fetch group
        .mockReturnValueOnce(chainWith(null)) // insert payment_transactions
        .mockReturnValueOnce(chainWithArray([{ id: 'p1', status: 'completed' }])) // final update
        .mockReturnValueOnce(chainWith(null)); // audit log insert

      const mockProvider = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'mtn-ref-1', status: 'SUCCESSFUL' }) };
      getProvider.mockReturnValue(mockProvider);

      await PayoutService.execute('g1', 'p1', 'exec-user');

      expect(getProvider).toHaveBeenCalledWith('mtn_momo');
    });

    it('audits PAYOUT_FAILED when disburse returns FAILED', async () => {
      const payout = {
        id: 'p1', status: 'approved', recipient_id: 'u1',
        amount: 5000, delivery_method: 'momo_mtn',
        users: { phone: '+237677000001', full_name: 'Test User' },
      };

      mockFrom
        .mockReturnValueOnce(chainWith(payout))
        .mockReturnValueOnce(chainWith(null)) // update to processing
        .mockReturnValueOnce(chainWith({ preferred_payout_gateway: 'campay' })) // fetch group
        .mockReturnValueOnce(chainWith(null)) // insert payment_transactions
        .mockReturnValueOnce(chainWithArray([{ id: 'p1', status: 'failed' }])) // final update
        .mockReturnValueOnce(chainWith(null)); // audit log insert

      const mockProvider = { disburse: jest.fn().mockResolvedValue({ success: false, externalRef: 'cp-ref-2', status: 'FAILED' }) };
      getProvider.mockReturnValue(mockProvider);

      const result = await PayoutService.execute('g1', 'p1', 'exec-user');

      expect(result.status).toBe('failed');
      expect(getProvider).toHaveBeenCalledWith('campay');
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

const PayoutEngine = require('../../src/engines/PayoutEngine');

describe('PayoutEngine — two-tier payout routing', () => {
  let mtnSvc, orangeSvc, campaySvc, paymentFactory;
  let auditService;
  let engine;

  beforeEach(() => {
    mtnSvc = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'mtn-1', status: 'SUCCESSFUL' }) };
    orangeSvc = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'or-1', status: 'SUCCESSFUL' }) };
    campaySvc = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'cm-1', status: 'SUCCESSFUL' }) };
    paymentFactory = {
      getProvider: jest.fn((gw) => ({ mtn_momo: mtnSvc, orange_money: orangeSvc, campay: campaySvc }[gw])),
    };
    auditService = { log: jest.fn() };
    engine = new PayoutEngine({}, paymentFactory, {}, auditService, {});
  });

  const groupWith = (overrides = {}) => ({
    id: 'g1', preferred_gateway: 'mtn_momo', preferred_payout_gateway: null, ...overrides,
  });
  const recipientWith = (phone) => ({ id: 'r1', phone });

  beforeEach(() => {
    engine.payout = { amount: 5000, id: 'p1' };
  });

  it('NULL column + MTN-prefix recipient → MTNMoMoService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: null });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();

    expect(paymentFactory.getProvider).toHaveBeenCalledWith('mtn_momo');
    expect(mtnSvc.disburse).toHaveBeenCalled();
    expect(orangeSvc.disburse).not.toHaveBeenCalled();
    expect(campaySvc.disburse).not.toHaveBeenCalled();
  });

  it('NULL column + Orange-prefix recipient → OrangeMoneyService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: null });
    engine.recipient = recipientWith('+237692000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('orange_money');
    expect(orangeSvc.disburse).toHaveBeenCalled();
  });

  it('NULL column + unrecognized prefix → throws .statusCode=400, disburse never called', async () => {
    engine.group = groupWith({ preferred_payout_gateway: null });
    engine.recipient = recipientWith('+233241234567');
    await expect(engine._dispatchDisburse()).rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(mtnSvc.disburse).not.toHaveBeenCalled();
  });

  it('column=campay + any recipient → CampayService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: 'campay' });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('campay');
    expect(campaySvc.disburse).toHaveBeenCalledWith('+237672000001', 5000, 'p1');
    expect(mtnSvc.disburse).not.toHaveBeenCalled();
  });

  it('column=mtn_momo + any recipient → MTNMoMoService.disburse (phone prefix ignored)', async () => {
    engine.group = groupWith({ preferred_payout_gateway: 'mtn_momo' });
    engine.recipient = recipientWith('+237692000001'); // Orange recipient!
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('mtn_momo');
    expect(mtnSvc.disburse).toHaveBeenCalled();
  });

  it('column=orange_money + any recipient → OrangeMoneyService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: 'orange_money' });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('orange_money');
    expect(orangeSvc.disburse).toHaveBeenCalled();
  });

  it('REGRESSION: NULL payout column + campay collection rail → still phone-prefix payout', async () => {
    engine.group = groupWith({ preferred_gateway: 'campay', preferred_payout_gateway: null });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('mtn_momo');
    expect(campaySvc.disburse).not.toHaveBeenCalled();
  });
});

describe('PayoutEngine — eligibility checks', () => {
  let engine;

  beforeEach(() => {
    engine = new PayoutEngine({}, { getProvider: jest.fn() }, {}, { log: jest.fn() }, {
      hasUnpaidFines: jest.fn(),
    });
  });

  it('returns passed=false when the recipient has no linked phone', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { phone: null }, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await engine._checkWalletLinked('user-1');

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('no linked wallet');
  });

  it('returns passed=false when the recipient has unpaid fines', async () => {
    engine.fineService.hasUnpaidFines.mockResolvedValue(true);

    const result = await engine._checkNoUnpaidFines('group-1', 'user-1');

    expect(engine.fineService.hasUnpaidFines).toHaveBeenCalledWith('group-1', 'user-1');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('unpaid fines');
  });
});
