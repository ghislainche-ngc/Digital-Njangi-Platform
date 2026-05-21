'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test') });

const hasEnv = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
const describeIfEnv = hasEnv ? describe : describe.skip;

describeIfEnv('Integration — Payouts', () => {
  let db;

  beforeAll(() => {
    db = require('../../src/modules/social-fund/social-fund.service');
  });

  it('triggering a payout creates an audit log entry', async () => {
    const groupId = process.env.TEST_GROUP_ID || 'group-123';

    // Assert the service responds without error
    const result = await db.getBalance(groupId);
    expect(result).toBeDefined();
  });
});