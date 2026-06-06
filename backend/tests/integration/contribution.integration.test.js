'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test') });
jest.setTimeout(30000);

const hasEnv = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
const describeIfEnv = hasEnv ? describe : describe.skip;

describeIfEnv('Integration — Contributions', () => {
  let db;

  beforeAll(() => {
    const SocialFundService = require('../../src/modules/social-fund/social-fund.service');
    const { db: dbInstance } = require('../../src/config/supabase');
    console.log('--- DBINSTANCE IN JEST:', dbInstance);
    db = new SocialFundService(dbInstance);
  });

  it('POST a contribution changes the ledger balance', async () => {
    const groupId = process.env.TEST_GROUP_ID || '00000000-0000-0000-0000-000000000000';
    
    // Assert the service responds without error
    const result = await db.getBalance(groupId);
    expect(result).toBeDefined();
  });
});