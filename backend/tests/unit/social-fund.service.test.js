'use strict';

const SocialFundService = require('../../src/modules/social-fund/social-fund.service');

describe('SocialFundService', () => {
  let db;
  let service;
  const GROUP_ID = 'group-123';
  const USER_ID = 'user-456';

  beforeEach(() => {
    db = {
      create: jest.fn(),
      findAll: jest.fn(),
    };
    service = new SocialFundService(db);
  });

  describe('getBalance', () => {
    it('returns 5000 after a single deposit of 5000', async () => {
      db.findAll.mockResolvedValue([
        { type: 'deposit', amount: 5000 },
      ]);

      const balance = await service.getBalance(GROUP_ID);

      expect(db.findAll).toHaveBeenCalledWith('social_fund_events', {
        group_id: GROUP_ID,
      });
      expect(balance).toBe(5000);
    });

    it('returns 2000 for deposits of 5000 and a withdrawal of 3000', async () => {
      db.findAll.mockResolvedValue([
        { type: 'deposit', amount: 2000 },
        { type: 'deposit', amount: 3000 },
        { type: 'withdrawal', amount: 3000 },
      ]);

      const balance = await service.getBalance(GROUP_ID);

      expect(balance).toBe(2000);
    });

    it('returns 0 when there are no events', async () => {
      db.findAll.mockResolvedValue([]);

      const balance = await service.getBalance(GROUP_ID);

      expect(balance).toBe(0);
    });
  });

  describe('recordDeposit', () => {
    it('creates a deposit event and returns the created row', async () => {
      const created = { id: 'evt-1', type: 'deposit', amount: 5000 };
      db.create.mockResolvedValue([created]);

      const result = await service.recordDeposit(
        GROUP_ID,
        5000,
        'Monthly contribution',
        USER_ID
      );

      expect(db.create).toHaveBeenCalledWith('social_fund_events', {
        group_id: GROUP_ID,
        type: 'deposit',
        amount: 5000,
        reason: 'Monthly contribution',
        recorded_by: USER_ID,
      });
      expect(result).toEqual(created);
    });

    it('throws a 400 error when the amount is 0', async () => {
      expect.assertions(2);
      try {
        await service.recordDeposit(GROUP_ID, 0, 'Invalid', USER_ID);
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(db.create).not.toHaveBeenCalled();
      }
    });
  });

  describe('recordWithdrawal', () => {
    it('creates a withdrawal event when funds are sufficient', async () => {
      db.findAll.mockResolvedValue([{ type: 'deposit', amount: 5000 }]);
      const created = { id: 'evt-2', type: 'withdrawal', amount: 3000 };
      db.create.mockResolvedValue([created]);

      const result = await service.recordWithdrawal(
        GROUP_ID,
        3000,
        'Member support',
        USER_ID
      );

      expect(db.create).toHaveBeenCalledWith('social_fund_events', {
        group_id: GROUP_ID,
        type: 'withdrawal',
        amount: 3000,
        reason: 'Member support',
        recorded_by: USER_ID,
      });
      expect(result).toEqual(created);
    });

    it('throws a 400 error when withdrawing 3000 with a balance of 2000', async () => {
      // balance computes to 2000
      db.findAll.mockResolvedValue([
        { type: 'deposit', amount: 5000 },
        { type: 'withdrawal', amount: 3000 },
      ]);

      expect.assertions(3);
      try {
        await service.recordWithdrawal(GROUP_ID, 3000, 'Too much', USER_ID);
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toMatch(/insufficient funds/i);
        expect(db.create).not.toHaveBeenCalled();
      }
    });
  });
});
