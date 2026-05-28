'use strict';

/**
 * SocialFundService — deposit, withdraw, check balance.
 *
 * @task Dev C — Task C-04
 */
class SocialFundService {
  /**
   * @param {object} db DBConnect instance (dependency injection).
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Compute the current social fund balance for a group.
   * balance = SUM(deposits) - SUM(withdrawals)
   * @param {string} groupId
   * @returns {Promise<number>}
   */
  async getBalance(groupId) {
    const events = await this.db.findAll('social_fund_events', { group_id: groupId });

    if (!events || events.length === 0) {
      return 0;
    }

    let balance = 0;
    for (const event of events) {
      const amount = Number(event.amount);
      if (event.type === 'deposit') {
        balance += amount;
      } else if (event.type === 'withdrawal') {
        balance -= amount;
      }
    }
    return balance;
  }

  /**
   * Record a deposit into the group social fund.
   * @returns {Promise<object>} the created event row
   */
  async recordDeposit(groupId, amount, reason, recordedBy) {
    if (amount <= 0) {
      const err = new Error('Deposit amount must be greater than zero');
      err.statusCode = 400;
      throw err;
    }

    const rows = await this.db.create('social_fund_events', {
      group_id: groupId,
      type: 'deposit',
      amount,
      reason,
      recorded_by: recordedBy,
    });

    return Array.isArray(rows) ? rows[0] : rows;
  }

  /**
   * Record a withdrawal from the group social fund.
   * Throws 400 if the amount exceeds the available balance.
   * @returns {Promise<object>} the created event row
   */
  async recordWithdrawal(groupId, amount, reason, recordedBy) {
    if (amount <= 0) {
      const err = new Error('Withdrawal amount must be greater than zero');
      err.statusCode = 400;
      throw err;
    }

    const balance = await this.getBalance(groupId);
    if (amount > balance) {
      const err = new Error(
        `Insufficient funds: balance is ${balance}, requested ${amount}`
      );
      err.statusCode = 400;
      throw err;
    }

    const rows = await this.db.create('social_fund_events', {
      group_id: groupId,
      type: 'withdrawal',
      amount,
      reason,
      recorded_by: recordedBy,
    });

    return Array.isArray(rows) ? rows[0] : rows;
  }

  /**
   * Get all social fund events for a group, sorted by created_at descending.
   * @param {string} groupId
   * @returns {Promise<Array<object>>}
   */
  async getEvents(groupId) {
    const events = await this.db.findAll('social_fund_events', { group_id: groupId });
    if (!events) return [];
    return events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

module.exports = SocialFundService;
