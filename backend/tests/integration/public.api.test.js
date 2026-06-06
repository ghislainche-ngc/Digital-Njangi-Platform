'use strict';

require('dotenv').config({ path: '.env.test' });
jest.setTimeout(30000);

const hasTestDb = Boolean(process.env.SUPABASE_URL && process.env.JWT_SECRET);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Public API', () => {
  let request;
  let app;

  beforeAll(() => {
    request = require('supertest');
    app = require('../../src/app');
  });

  describe('GET /public/stats', () => {
    it('returns platform-wide metrics and a list of recent transactions (200)', async () => {
      const res = await request(app)
        .get('/public/stats')
        .expect(200);

      expect(res.body).toHaveProperty('totalGroups');
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('totalVolume');
      expect(res.body).toHaveProperty('recentTransactions');
      expect(typeof res.body.totalGroups).toBe('number');
      expect(typeof res.body.totalUsers).toBe('number');
      expect(typeof res.body.totalVolume).toBe('number');
      expect(Array.isArray(res.body.recentTransactions)).toBe(true);

      if (res.body.recentTransactions.length > 0) {
        const firstTx = res.body.recentTransactions[0];
        expect(firstTx).toHaveProperty('userName');
        expect(firstTx).toHaveProperty('amount');
        expect(firstTx).toHaveProperty('gateway');
        expect(firstTx).toHaveProperty('status');
      }
    });
  });
});
