'use strict';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const mockFrom = jest.fn();
jest.mock('../../src/config/supabase', () => ({
  supabase: { from: mockFrom },
}));

const memberService = require('../../src/modules/members/member.service');

function chainMock(finalData = null, finalError = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });
  return chain;
}

function mockSupabase(tableMocks = {}) {
  let callCounts = {};
  mockFrom.mockImplementation((table) => {
    callCounts[table] = (callCounts[table] || 0) + 1;

    if (table === 'njangi_groups' && !tableMocks.njangi_groups) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      return chainMock({
        subscription_tier: 'starter',
        subscription_status: 'active',
        subscription_expires_at: expiry.toISOString()
      });
    }

    const mockCreator = tableMocks[table];
    if (typeof mockCreator === 'function') {
      return mockCreator(callCounts[table]);
    }
    return mockCreator || chainMock();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase({});
});

describe('MemberService.inviteMember', () => {
  it('creates invitation and logs audit event', async () => {
    const invitation = { id: 'inv-1', group_id: 'grp-1', phone: '+237677000002', token: 'abc' };
    mockSupabase({
      invitations: (count) => {
        if (count === 1) return chainMock(null); // existing check
        return chainMock(invitation); // insertion
      },
      memberships: () => chainMock(null), // already member check
      users: () => chainMock(null),
      audit_events: () => ({ insert: jest.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await memberService.inviteMember('grp-1', '+237677000002', 'user-pres');
    expect(result.id).toBe('inv-1');
  });

  it('throws 409 for duplicate pending invitation', async () => {
    mockSupabase({
      invitations: () => chainMock({ id: 'existing-inv' }),
      memberships: () => chainMock(null),
    });

    await expect(
      memberService.inviteMember('grp-1', '+237677000002', 'user-pres')
    ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_INVITE' });
  });
});

describe('MemberService.acceptInvite', () => {
  it('creates membership for valid token', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const invitation = { id: 'inv-1', group_id: 'grp-1', token: 'abc', status: 'pending', expires_at: futureDate, invited_by: 'user-pres' };
    const membership = { id: 'mem-1', role: 'member', rotation_position: 3 };

    let membershipsCallCount = 0;
    mockSupabase({
      invitations: (count) => {
        if (count === 1) return chainMock(invitation); // findOne check
        return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) }; // mark accepted
      },
      memberships: (count) => {
        membershipsCallCount++;
        // First two calls:
        // 1. _enforce count check
        // 2. acceptInvite count check
        if (membershipsCallCount <= 2) {
          const c = {};
          c.select = jest.fn().mockReturnValue(c);
          c.eq = jest.fn().mockReturnValueOnce(c).mockResolvedValueOnce({ count: 2 });
          return c;
        }
        return chainMock(membership); // insert
      },
      audit_events: () => ({ insert: jest.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await memberService.acceptInvite('abc', 'user-new');
    expect(result.role).toBe('member');
  });

  it('throws 400 for expired token', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const invitation = { id: 'inv-1', expires_at: pastDate, status: 'pending' };

    mockSupabase({
      invitations: (count) => {
        if (count === 1) return chainMock(invitation);
        return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) };
      }
    });

    await expect(
      memberService.acceptInvite('expired-token', 'user-new')
    ).rejects.toMatchObject({ statusCode: 400, code: 'EXPIRED_TOKEN' });
  });

  it('throws 400 for invalid token', async () => {
    mockSupabase({
      invitations: () => chainMock(null, { message: 'not found' })
    });

    await expect(
      memberService.acceptInvite('bad-token', 'user-new')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TOKEN' });
  });
});

describe('MemberService.removeMember', () => {
  it('president removes member and logs audit event', async () => {
    const removed = { id: 'mem-2', status: 'removed' };

    mockSupabase({
      memberships: (count) => {
        if (count === 1) return chainMock({ role: 'president' });
        return chainMock(removed);
      },
      audit_events: () => ({ insert: jest.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await memberService.removeMember('grp-1', 'user-target', 'user-pres');
    expect(result.status).toBe('removed');
  });

  it('president cannot remove themselves', async () => {
    mockSupabase({
      memberships: () => chainMock({ role: 'president' }),
    });

    await expect(
      memberService.removeMember('grp-1', 'user-pres', 'user-pres')
    ).rejects.toMatchObject({ statusCode: 400, code: 'PRESIDENT_SELF_REMOVE' });
  });
});

describe('MemberService.assignRole', () => {
  it('cannot change own role', async () => {
    await expect(
      memberService.assignRole('grp-1', 'user-1', 'treasurer', 'user-1')
    ).rejects.toMatchObject({ statusCode: 400, code: 'SELF_ROLE_CHANGE' });
  });

  it('assigns new role and logs audit event', async () => {
    const updated = { id: 'mem-1', role: 'treasurer' };

    mockSupabase({
      memberships: () => chainMock(updated),
      audit_events: () => ({ insert: jest.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await memberService.assignRole('grp-1', 'user-target', 'treasurer', 'user-pres');
    expect(result.role).toBe('treasurer');
  });
});

describe('SaaS Member Limits and Subscriptions', () => {
  it('throws SUBSCRIPTION_EXPIRED when group has expired subscription', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockSupabase({
      njangi_groups: () => chainMock({
        subscription_tier: 'starter',
        subscription_status: 'active',
        subscription_expires_at: pastDate,
      })
    });

    await expect(
      memberService.inviteMember('grp-1', '+237677000002', 'user-pres')
    ).rejects.toMatchObject({ statusCode: 402, code: 'SUBSCRIPTION_EXPIRED' });
  });

  it('throws TIER_LIMIT_REACHED when Starter tier has 5 active members', async () => {
    mockSupabase({
      njangi_groups: () => chainMock({
        subscription_tier: 'starter',
        subscription_status: 'active',
        subscription_expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
      memberships: () => {
        const c = {};
        c.select = jest.fn().mockReturnValue(c);
        c.eq = jest.fn().mockReturnValueOnce(c).mockResolvedValueOnce({ count: 5 });
        return c;
      }
    });

    await expect(
      memberService.inviteMember('grp-1', '+237677000002', 'user-pres')
    ).rejects.toMatchObject({ statusCode: 403, code: 'TIER_LIMIT_REACHED' });
  });

  it('throws TIER_LIMIT_REACHED when Growth tier has 20 active members', async () => {
    mockSupabase({
      njangi_groups: () => chainMock({
        subscription_tier: 'growth',
        subscription_status: 'active',
        subscription_expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
      memberships: () => {
        const c = {};
        c.select = jest.fn().mockReturnValue(c);
        c.eq = jest.fn().mockReturnValueOnce(c).mockResolvedValueOnce({ count: 20 });
        return c;
      }
    });

    await expect(
      memberService.inviteMember('grp-1', '+237677000002', 'user-pres')
    ).rejects.toMatchObject({ statusCode: 403, code: 'TIER_LIMIT_REACHED' });
  });
});
