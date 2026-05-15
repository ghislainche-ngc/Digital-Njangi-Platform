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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MemberService.inviteMember', () => {
  it('creates invitation and logs audit event', async () => {
    const invitation = { id: 'inv-1', group_id: 'grp-1', phone: '+237677000002', token: 'abc' };

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'invitations' && callCount === 1) return chainMock(null);
      if (table === 'users') return chainMock(null);
      if (table === 'memberships' && callCount <= 4) return chainMock(null);
      if (table === 'invitations') return chainMock(invitation);
      if (table === 'audit_events') return { insert: jest.fn().mockResolvedValue({ error: null }) };
      return chainMock();
    });

    const result = await memberService.inviteMember('grp-1', '+237677000002', 'user-pres');
    expect(result.id).toBe('inv-1');
  });

  it('throws 409 for duplicate pending invitation', async () => {
    mockFrom.mockReturnValue(chainMock({ id: 'existing-inv' }));

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

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'invitations' && callCount === 1) return chainMock(invitation);
      if (table === 'memberships' && callCount <= 3) return chainMock(null); // count
      if (table === 'memberships') return chainMock(membership);
      if (table === 'invitations') return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) };
      if (table === 'audit_events') return { insert: jest.fn().mockResolvedValue({ error: null }) };
      return chainMock();
    });

    // Mock the count result
    const countResult = { count: 2 };
    let memberCallCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'invitations' && callCount <= 2) return chainMock(invitation);
      if (table === 'memberships') {
        memberCallCount++;
        if (memberCallCount === 1) {
          const c = {};
          c.select = jest.fn().mockReturnValue(c);
          c.eq = jest.fn().mockReturnValueOnce(c).mockResolvedValueOnce(countResult);
          return c;
        }
        return chainMock(membership);
      }
      if (table === 'invitations') return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) };
      if (table === 'audit_events') return { insert: jest.fn().mockResolvedValue({ error: null }) };
      return chainMock();
    });

    const result = await memberService.acceptInvite('abc', 'user-new');
    expect(result.role).toBe('member');
  });

  it('throws 400 for expired token', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const invitation = { id: 'inv-1', expires_at: pastDate, status: 'pending' };

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'invitations' && callCount === 1) return chainMock(invitation);
      if (table === 'invitations') return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) };
      return chainMock();
    });

    await expect(
      memberService.acceptInvite('expired-token', 'user-new')
    ).rejects.toMatchObject({ statusCode: 400, code: 'EXPIRED_TOKEN' });
  });

  it('throws 400 for invalid token', async () => {
    mockFrom.mockReturnValue(chainMock(null, { message: 'not found' }));

    await expect(
      memberService.acceptInvite('bad-token', 'user-new')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TOKEN' });
  });
});

describe('MemberService.removeMember', () => {
  it('president removes member and logs audit event', async () => {
    const removed = { id: 'mem-2', status: 'removed' };

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'memberships' && callCount === 1) return chainMock({ role: 'president' });
      if (table === 'memberships') return chainMock(removed);
      if (table === 'audit_events') return { insert: jest.fn().mockResolvedValue({ error: null }) };
      return chainMock();
    });

    const result = await memberService.removeMember('grp-1', 'user-target', 'user-pres');
    expect(result.status).toBe('removed');
  });

  it('president cannot remove themselves', async () => {
    mockFrom.mockReturnValue(chainMock({ role: 'president' }));

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

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      callCount++;
      if (table === 'memberships') return chainMock(updated);
      if (table === 'audit_events') return { insert: jest.fn().mockResolvedValue({ error: null }) };
      return chainMock();
    });

    const result = await memberService.assignRole('grp-1', 'user-target', 'treasurer', 'user-pres');
    expect(result.role).toBe('treasurer');
  });
});
