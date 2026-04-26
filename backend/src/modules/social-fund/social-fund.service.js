'use strict';

const { supabase } = require('../../config/supabase');

/**
 * SocialFundService — deposit, withdraw, check balance.
 *
 * @task Dev C — Task C-04
 */
class SocialFundService {
  async getBalance(groupId) {
    // TODO (Dev C): SUM deposits - SUM withdrawals
    throw new Error('Not implemented');
  }

  async recordDeposit(groupId, amount, reason, recordedBy) {
    // TODO (Dev C): insert social_fund_events { type: 'deposit' }
    throw new Error('Not implemented');
  }

  async recordWithdrawal(groupId, amount, reason, recordedBy) {
    // TODO (Dev C):
    // 1. Get current balance
    // 2. If amount > balance → throw 400 (insufficient funds)
    // 3. Insert social_fund_events { type: 'withdrawal' }
    throw new Error('Not implemented');
  }
}

module.exports = new SocialFundService();
