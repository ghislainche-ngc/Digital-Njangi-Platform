'use strict';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.NODE_ENV = 'test';

jest.mock('../../src/config/supabase', () => {
  const mockFrom = jest.fn();
  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

const { __mockFrom: mockFrom } = require('../../src/config/supabase');
const adminService = require('../../src/modules/admin/admin.service');

function chainMock(finalData = null, finalError = null, finalCount = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });
  
  // Handle select count query (e.g. stats count queries)
  const countPromise = Promise.resolve({ count: finalCount, data: finalData, error: finalError });
  chain.then = countPromise.then.bind(countPromise);
  chain.catch = countPromise.catch.bind(countPromise);
  
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AdminService', () => {
  describe('getPlatformStats', () => {
    it('calculates platform-wide stats and MRR correctly', async () => {
      // Setup mock queries
      mockFrom.mockImplementation((table) => {
        if (table === 'njangi_groups') {
          // First query: count
          // Second query: select subscription_tier, subscription_status
          return {
            select: jest.fn().mockImplementation((cols, opts) => {
              if (opts && opts.count) {
                // Count query
                return chainMock(null, null, 10);
              }
              // MRR query
              return chainMock([
                { subscription_tier: 'starter', subscription_status: 'active' },
                { subscription_tier: 'growth', subscription_status: 'active' },      // +5000
                { subscription_tier: 'enterprise', subscription_status: 'active' },  // +15000
                { subscription_tier: 'growth', subscription_status: 'canceled' },   // +0 (inactive)
              ]);
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue(chainMock(null, null, 150))
          };
        }
        if (table === 'payment_transactions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue(
                  chainMock([
                    { amount: 10000 },
                    { amount: 25000 },
                  ])
                )
              })
            })
          };
        }
        return chainMock();
      });

      const stats = await adminService.getPlatformStats();
      expect(stats.totalGroups).toBe(10);
      expect(stats.totalUsers).toBe(150);
      expect(stats.totalVolume).toBe(35000);
      expect(stats.mrr).toBe(20000); // 5000 (growth) + 15000 (enterprise)
    });
  });

  describe('getPlatformGroups', () => {
    it('lists groups with resolved member counts and presidents', async () => {
      mockFrom.mockImplementation((table) => {
        if (table === 'njangi_groups') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  { id: 'group-1', name: 'Njangi A', subscription_tier: 'starter', status: 'active' },
                  { id: 'group-2', name: 'Njangi B', subscription_tier: 'growth', status: 'active' }
                ],
                error: null
              })
            })
          };
        }
        if (table === 'memberships') {
          return {
            select: jest.fn().mockImplementation((cols) => {
              if (cols === 'group_id') {
                // Member counts
                return {
                  eq: jest.fn().mockResolvedValue({
                    data: [
                      { group_id: 'group-1' },
                      { group_id: 'group-1' },
                      { group_id: 'group-2' }
                    ],
                    error: null
                  })
                };
              }
              // Presidents query
              return {
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [
                      { group_id: 'group-1', user_id: 'user-p1', users: { full_name: 'Pres One', email: 'p1@test.com' } },
                      { group_id: 'group-2', user_id: 'user-p2', users: { full_name: 'Pres Two', email: 'p2@test.com' } }
                    ],
                    error: null
                  })
                })
              };
            })
          };
        }
        return chainMock();
      });

      const groups = await adminService.getPlatformGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].memberCount).toBe(2);
      expect(groups[0].president.name).toBe('Pres One');
      expect(groups[1].memberCount).toBe(1);
      expect(groups[1].president.name).toBe('Pres Two');
    });
  });

  describe('updateGroupSubscription', () => {
    it('updates subscription parameters', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue(chainMock({
          id: 'group-1',
          subscription_tier: 'growth',
          subscription_status: 'active'
        }))
      });
      mockFrom.mockReturnValue({ update: updateMock });

      const group = await adminService.updateGroupSubscription('group-1', {
        subscription_tier: 'growth',
        subscription_status: 'active'
      });

      expect(updateMock).toHaveBeenCalledWith({
        subscription_tier: 'growth',
        subscription_status: 'active'
      });
      expect(group.subscription_tier).toBe('growth');
    });
  });

  describe('updateGroupStatus', () => {
    it('updates the status field', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue(chainMock({
          id: 'group-1',
          status: 'suspended'
        }))
      });
      mockFrom.mockReturnValue({ update: updateMock });

      const group = await adminService.updateGroupStatus('group-1', 'suspended');

      expect(updateMock).toHaveBeenCalledWith({ status: 'suspended' });
      expect(group.status).toBe('suspended');
    });
  });

  describe('getGlobalTransactions', () => {
    it('returns global transaction log with resolved group and user names', async () => {
      mockFrom.mockImplementation((table) => {
        if (table === 'payment_transactions') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    { id: 'tx-1', reference_type: 'contribution', reference_id: 'c-1', gateway: 'campay', amount: 5000, direction: 'debit', status: 'success' },
                    { id: 'tx-2', reference_type: 'payout', reference_id: 'p-1', gateway: 'mtn_momo', amount: 15000, direction: 'credit', status: 'success' }
                  ],
                  error: null
                })
              })
            })
          };
        }
        if (table === 'contributions') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'c-1', group_id: 'group-A', user_id: 'user-X' }
                ],
                error: null
              })
            })
          };
        }
        if (table === 'payouts') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'p-1', group_id: 'group-B', recipient_id: 'user-Y' }
                ],
                error: null
              })
            })
          };
        }
        if (table === 'njangi_groups') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'group-A', name: 'Njangi A' },
                  { id: 'group-B', name: 'Njangi B' }
                ],
                error: null
              })
            })
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'user-X', full_name: 'User X' },
                  { id: 'user-Y', full_name: 'User Y' }
                ],
                error: null
              })
            })
          };
        }
        return chainMock();
      });

      const txs = await adminService.getGlobalTransactions();
      expect(txs).toHaveLength(2);
      expect(txs[0].groupName).toBe('Njangi A');
      expect(txs[0].userName).toBe('User X');
      expect(txs[1].groupName).toBe('Njangi B');
      expect(txs[1].userName).toBe('User Y');
    });
  });

  describe('getPlatformUsers', () => {
    it('returns all users with their active memberships', async () => {
      mockFrom.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  { id: 'user-1', email: 'u1@test.com', phone: '123', full_name: 'User One', language: 'en', is_admin: false, created_at: '2026-05-30T00:00:00Z' },
                  { id: 'user-2', email: 'u2@test.com', phone: '456', full_name: 'User Two', language: 'fr', is_admin: true, created_at: '2026-05-30T00:00:00Z' }
                ],
                error: null
              })
            })
          };
        }
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { user_id: 'user-1', role: 'member', njangi_groups: { name: 'Group A' } },
                  { user_id: 'user-1', role: 'secretary', njangi_groups: { name: 'Group B' } }
                ],
                error: null
              })
            })
          };
        }
        return chainMock();
      });

      const users = await adminService.getPlatformUsers();
      expect(users).toHaveLength(2);
      expect(users[0].id).toBe('user-1');
      expect(users[0].memberships).toHaveLength(2);
      expect(users[0].memberships[0].groupName).toBe('Group A');
      expect(users[1].id).toBe('user-2');
      expect(users[1].memberships).toHaveLength(0);
    });
  });

  describe('updateUserRole', () => {
    it('promotes/demotes other users successfully', async () => {
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user-2', is_admin: true },
              error: null
            })
          })
        })
      });
      mockFrom.mockReturnValue({ update: updateMock });

      const res = await adminService.updateUserRole('user-2', { is_admin: true }, 'admin-user');
      expect(updateMock).toHaveBeenCalledWith({ is_admin: true });
      expect(res.is_admin).toBe(true);
    });

    it('rejects self-demotion', async () => {
      await expect(
        adminService.updateUserRole('admin-user', { is_admin: false }, 'admin-user')
      ).rejects.toThrow('You cannot revoke your own administrator privileges.');
    });
  });

  describe('deleteUser', () => {
    it('deletes user successfully if all checks pass', async () => {
      mockFrom.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [], // not a president
                    error: null
                  })
                })
              })
            })
          };
        }
        if (table === 'users') {
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                error: null
              })
            })
          };
        }
        return chainMock();
      });

      const res = await adminService.deleteUser('user-2', 'admin-user');
      expect(res.success).toBe(true);
    });

    it('rejects self-deletion', async () => {
      await expect(
        adminService.deleteUser('admin-user', 'admin-user')
      ).rejects.toThrow('You cannot delete your own account.');
    });

    it('rejects deletion of active group president', async () => {
      mockFrom.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [{ group_id: 'group-1' }], // is president of group-1
                    error: null
                  })
                })
              })
            })
          };
        }
        return chainMock();
      });

      await expect(
        adminService.deleteUser('user-2', 'admin-user')
      ).rejects.toThrow('User is the active President of a Njangi group. Transfer group presidency before deleting.');
    });
  });
});
