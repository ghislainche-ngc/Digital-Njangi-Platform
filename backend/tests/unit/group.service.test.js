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
    const updated = { id: 'grp-1', contribution_amount: 15000 };
    mockFrom.mockReturnValue(chainMock(updated));

    const result = await groupService.updateSettings('grp-1', { contribution_amount: 15000 });
    expect(result.contribution_amount).toBe(15000);
  });
});
