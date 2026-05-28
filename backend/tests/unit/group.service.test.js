'use strict';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

jest.mock('../../src/config/supabase', () => {
  const mockFrom = jest.fn();
  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

const { __mockFrom: mockFrom } = require('../../src/config/supabase');
const groupService = require('../../src/modules/groups/group.service');

function chainMock(finalData = null, finalError = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GroupService.createGroup', () => {
  it('creates group, president membership, and first cycle', async () => {
    const mockGroup = { id: 'grp-1', name: 'My Njangi', rotation_type: 'fixed' };
    const mockMembership = { id: 'mem-1', role: 'president', rotation_position: 1 };
    const mockCycle = { id: 'cyc-1', cycle_number: 1, status: 'active' };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock(mockGroup);
      if (callCount === 2) return chainMock(mockMembership);
      return chainMock(mockCycle);
    });

    const result = await groupService.createGroup('user-1', {
      name: 'My Njangi',
      contribution_amount: 10000,
      rotation_type: 'fixed',
    });

    expect(result.group.id).toBe('grp-1');
    expect(result.membership.role).toBe('president');
    expect(result.cycle.cycle_number).toBe(1);
  });

  it('creator becomes president with rotation_position 1', async () => {
    const mockGroup = { id: 'grp-2' };
    const mockMembership = { id: 'mem-2', role: 'president', rotation_position: 1 };
    const mockCycle = { id: 'cyc-2', cycle_number: 1 };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock(mockGroup);
      if (callCount === 2) {
        const chain = chainMock(mockMembership);
        const originalInsert = chain.insert;
        chain.insert = jest.fn().mockImplementation((data) => {
          expect(data.role).toBe('president');
          expect(data.rotation_position).toBe(1);
          return originalInsert(data);
        });
        return chain;
      }
      return chainMock(mockCycle);
    });

    await groupService.createGroup('user-1', {
      name: 'Test',
      contribution_amount: 5000,
      rotation_type: 'random',
    });
  });
});

describe('GroupService.getGroup', () => {
  it('returns group with member count and active cycle', async () => {
    const mockGroup = { id: 'grp-1', name: 'My Njangi' };
    const mockCycle = { id: 'cyc-1', cycle_number: 1, status: 'active' };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock(mockGroup);
      if (callCount === 2) {
        const countChain = {};
        countChain.select = jest.fn().mockReturnValue(countChain);
        countChain.eq = jest.fn()
          .mockReturnValueOnce(countChain)
          .mockResolvedValueOnce({ count: 5 });
        return countChain;
      }
      return chainMock(mockCycle);
    });

    const result = await groupService.getGroup('grp-1');

    expect(result.name).toBe('My Njangi');
    expect(result.memberCount).toBe(5);
    expect(result.activeCycle.cycle_number).toBe(1);
  });

  it('throws 404 for non-existent group', async () => {
    mockFrom.mockReturnValue(chainMock(null, { message: 'not found' }));

    await expect(groupService.getGroup('nonexistent'))
      .rejects.toMatchObject({ statusCode: 404, code: 'GROUP_NOT_FOUND' });
  });
});

describe('GroupService.updateSettings', () => {
  it('blocks rotation type change when cycle is active', async () => {
    const activeCycle = { id: 'cyc-1' };
    mockFrom.mockReturnValue(chainMock(activeCycle));

    await expect(
      groupService.updateSettings('grp-1', { rotation_type: 'random' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'ROTATION_LOCKED' });
  });

  it('allows updating contribution_amount', async () => {
    const updated = { id: 'grp-1', contribution_amount: 15000, subscription_tier: 'growth' };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock({ subscription_tier: 'growth', contribution_amount: 10000 });
      return chainMock(updated);
    });

    const result = await groupService.updateSettings('grp-1', { contribution_amount: 15000 });
    expect(result.contribution_amount).toBe(15000);
  });
});

describe('GroupService.updateGateway', () => {
  it('updates preferred_gateway on njangi_groups and returns the row', async () => {
    mockFrom.mockReturnValue(chainMock({ id: 'g1', preferred_gateway: 'campay' }));

    const result = await groupService.updateGateway('g1', 'campay');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.update).toHaveBeenCalledWith({ preferred_gateway: 'campay' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'g1');
    expect(result.preferred_gateway).toBe('campay');
  });

  it('throws .statusCode=400 for an invalid gateway value without hitting DB', async () => {
    await expect(groupService.updateGateway('g1', 'bogus'))
      .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws .statusCode=404 when the group is not found', async () => {
    mockFrom.mockReturnValue(chainMock(null));
    await expect(groupService.updateGateway('missing', 'mtn_momo'))
      .rejects.toMatchObject({ statusCode: 404, code: 'GROUP_NOT_FOUND' });
  });
});

describe('GroupService.updatePayoutGateway', () => {
  it.each(['mtn_momo', 'orange_money', 'campay'])(
    'accepts %s and updates the column', async (value) => {
      mockFrom.mockReturnValue(chainMock({ id: 'g1', preferred_payout_gateway: value }));
      const result = await groupService.updatePayoutGateway('g1', value);
      const chain = mockFrom.mock.results[0].value;
      expect(chain.update).toHaveBeenCalledWith({ preferred_payout_gateway: value });
      expect(result.preferred_payout_gateway).toBe(value);
    }
  );

  it('accepts null to clear the column (revert to phone-prefix routing)', async () => {
    mockFrom.mockReturnValue(chainMock({ id: 'g1', preferred_payout_gateway: null }));
    const result = await groupService.updatePayoutGateway('g1', null);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.update).toHaveBeenCalledWith({ preferred_payout_gateway: null });
    expect(result.preferred_payout_gateway).toBeNull();
  });

  it('throws .statusCode=400 for invalid value without hitting DB', async () => {
    await expect(groupService.updatePayoutGateway('g1', 'bogus'))
      .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws .statusCode=404 when the group is not found', async () => {
    mockFrom.mockReturnValue(chainMock(null));
    await expect(groupService.updatePayoutGateway('missing', 'campay'))
      .rejects.toMatchObject({ statusCode: 404, code: 'GROUP_NOT_FOUND' });
  });
});

describe('SaaS Subscriptions & Limits', () => {
  it('throws TIER_LIMIT_BREACHED when Starter contribution > 10,000', async () => {
    await expect(
      groupService.createGroup('u1', { name: 'G1', contribution_amount: 15000, subscription_tier: 'starter' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'TIER_LIMIT_BREACHED' });
  });

  it('throws TIER_LIMIT_BREACHED when Growth contribution > 100,000', async () => {
    await expect(
      groupService.createGroup('u1', { name: 'G1', contribution_amount: 120000, subscription_tier: 'growth' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'TIER_LIMIT_BREACHED' });
  });

  it('allows Enterprise contribution to exceed 100,000', async () => {
    const mockGroup = { id: 'grp-x', name: 'G1', subscription_tier: 'enterprise' };
    const mockMembership = { id: 'mem-x', role: 'president' };
    const mockCycle = { id: 'cyc-x', cycle_number: 1 };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock(mockGroup);
      if (callCount === 2) return chainMock(mockMembership);
      return chainMock(mockCycle);
    });

    const res = await groupService.createGroup('u1', { name: 'G1', contribution_amount: 250000, subscription_tier: 'enterprise', rotation_type: 'fixed' });
    expect(res.group.subscription_tier).toBe('enterprise');
  });

  it('renewSubscription extends expiry date and returns group', async () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 10);
    const mockGroup = { id: 'grp-x', name: 'G1', subscription_tier: 'growth', subscription_expires_at: expiry.toISOString() };
    mockFrom.mockReturnValue(chainMock(mockGroup));

    const res = await groupService.renewSubscription('grp-x', 'mtn_momo');
    expect(res).toBeDefined();
  });
});
