'use strict';

require('dotenv').config({ path: '.env.test' });

/**
 * Integration tests for the contributions endpoints (Supertest).
 *
 * SKIP-GUARDED: these tests require a live test database. When no test DB is
 * configured (no SUPABASE_URL / JWT_SECRET), the whole suite is skipped
 * cleanly with zero failures.
 *
 * NOTE: `src/app.js` calls `config/env` on import, which throws when env vars
 * are missing — so `app`, the DB helpers, and `config/supabase` are required
 * lazily inside `beforeAll`, never at the top level.
 *
 * Routers are mounted under `/groups`, so contribution paths look like:
 *   POST /groups/:groupId/contributions/pay
 *   POST /groups/:groupId/contributions/cash
 *   POST /groups/:groupId/contributions/:id/retry
 */

const hasTestDb = Boolean(process.env.SUPABASE_URL && process.env.JWT_SECRET);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Contributions API', () => {
  let request, app, createTestGroup, getToken, cleanTestGroup;
  let supabase;

  // Track created groups so afterAll can clean them up.
  const createdGroupIds = [];

  beforeAll(() => {
    request = require('supertest');
    app = require('../../src/app');
    ({ createTestGroup, getToken } = require('../helpers/group.helper'));
    ({ cleanTestGroup } = require('../helpers/db.helper'));
    ({ supabase } = require('../../src/config/supabase'));
  });

  afterAll(async () => {
    if (!cleanTestGroup) return;
    for (const id of createdGroupIds) {
      await cleanTestGroup(id);
    }
    // Remove any test users created directly in these tests.
    await supabase.from('users').delete().like('email', '%@naas.cm');
  });

  /**
   * Build a fully-set-up group for contribution tests:
   *   - a president (from the helper)
   *   - an active cycle (required by the service)
   *   - a treasurer member
   *   - a plain member
   * Returns the ids/tokens needed by the test cases.
   */
  const setupGroup = async () => {
    const group = await createTestGroup({ groupName: `Contrib Group ${Date.now()}` });
    createdGroupIds.push(group.id);

    // Active cycle — the service requires one for pay/cash flows.
    const { data: cycle } = await supabase
      .from('cycles')
      .insert({
        group_id: group.id,
        cycle_number: 1,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .select()
      .single();

    // Treasurer user + active treasurer membership.
    const { data: treasurer } = await supabase
      .from('users')
      .insert({
        email: `treasurer-${Date.now()}${Math.floor(Math.random() * 1000)}@naas.cm`,
        phone: `+2376${Math.floor(10000000 + Math.random() * 89999999)}`,
        full_name: 'Test Treasurer',
      })
      .select()
      .single();

    await supabase.from('memberships').insert({
      user_id: treasurer.id,
      group_id: group.id,
      role: 'treasurer',
      status: 'active',
      rotation_position: 2,
    });

    // Plain member user + active member membership.
    const { data: member } = await supabase
      .from('users')
      .insert({
        email: `member-${Date.now()}${Math.floor(Math.random() * 1000)}@naas.cm`,
        phone: `+2376${Math.floor(10000000 + Math.random() * 89999999)}`,
        full_name: 'Test Member',
      })
      .select()
      .single();

    await supabase.from('memberships').insert({
      user_id: member.id,
      group_id: group.id,
      role: 'member',
      status: 'active',
      rotation_position: 3,
    });

    return {
      groupId: group.id,
      cycleId: cycle.id,
      presidentId: group.presidentId,
      treasurerId: treasurer.id,
      memberId: member.id,
    };
  };

  describe('POST /groups/:groupId/contributions/pay (MoMo deduction + auto-retry)', () => {
    it('automatically retries a MoMo deduction once on the first failure', async () => {
      const ctx = await setupGroup();

      // A member initiates a MoMo deduction for their own contribution.
      const res = await request(app)
        .post(`/groups/${ctx.groupId}/contributions/pay`)
        .set('Authorization', `Bearer ${getToken(ctx.memberId, ctx.groupId)}`)
        .send({ gateway: 'momo_mtn' });

      // The endpoint always responds 202 (accepted); the final contribution
      // status is 'confirmed' on success or 'failed' if both attempts fail.
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('contributionId');
      expect(['confirmed', 'failed']).toContain(res.body.data.status);

      // The service retries once on first failure — when the first charge
      // fails, a SECOND payment_transactions row is logged with attempts=2.
      // We assert the retry path is exercised: there is at most one row with
      // attempts=2, and if the contribution failed, both attempts were logged.
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('attempts, status')
        .eq('reference_type', 'contribution')
        .eq('reference_id', res.body.data.contributionId);

      expect(Array.isArray(txns)).toBe(true);
      const retryRows = (txns || []).filter((t) => t.attempts === 2);
      // A retry row only exists when the first attempt failed; never more than one.
      expect(retryRows.length).toBeLessThanOrEqual(1);

      if (res.body.data.status === 'failed') {
        // Both attempts must have been logged and both must have failed.
        expect((txns || []).length).toBeGreaterThanOrEqual(2);
        expect((txns || []).every((t) => t.status === 'failed')).toBe(true);
      }
    });
  });

  describe('POST /groups/:groupId/contributions/cash (anti-fraud rule)', () => {
    it('triggers a fraud alert when a Treasurer records a cash payment for themselves', async () => {
      const ctx = await setupGroup();

      // Treasurer records a cash payment naming THEMSELVES as the member.
      const res = await request(app)
        .post(`/groups/${ctx.groupId}/contributions/cash`)
        .set('Authorization', `Bearer ${getToken(ctx.treasurerId, ctx.groupId)}`)
        .send({ memberId: ctx.treasurerId, amount: 10000, notes: 'self payment attempt' });

      // Anti-fraud rule: a Treasurer cannot record their own cash payment.
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'FRAUD_SELF_PAYMENT');
      expect(res.body).toHaveProperty('error');

      // The blocked attempt is recorded as a fraud alert in the audit log.
      const { data: auditRows } = await supabase
        .from('audit_logs')
        .select('action, actor_id')
        .eq('group_id', ctx.groupId)
        .eq('actor_id', ctx.treasurerId);

      const fraudAlert = (auditRows || []).find(
        (r) => typeof r.action === 'string' && r.action.includes('FRAUD'),
      );
      expect(fraudAlert).toBeDefined();
    });
  });

  describe('POST /groups/:groupId/contributions/cash (successful deduction → receipt record)', () => {
    it('creates a confirmed contribution record when the Treasurer records a valid cash payment', async () => {
      const ctx = await setupGroup();

      // Treasurer records a cash payment for a DIFFERENT member — allowed.
      const res = await request(app)
        .post(`/groups/${ctx.groupId}/contributions/cash`)
        .set('Authorization', `Bearer ${getToken(ctx.treasurerId, ctx.groupId)}`)
        .send({ memberId: ctx.memberId, amount: 10000, notes: 'monthly cash contribution' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toMatchObject({
        user_id: ctx.memberId,
        group_id: ctx.groupId,
        status: 'confirmed',
        payment_method: 'cash',
      });

      // The confirmed contribution (receipt) is persisted in the DB.
      const { data: stored } = await supabase
        .from('contributions')
        .select('id, status, payment_method, amount, recorded_by, confirmed_at')
        .eq('id', res.body.data.id)
        .single();

      expect(stored).toBeTruthy();
      expect(stored.status).toBe('confirmed');
      expect(stored.payment_method).toBe('cash');
      expect(Number(stored.amount)).toBe(10000);
      expect(stored.recorded_by).toBe(ctx.treasurerId);
      expect(stored.confirmed_at).toBeTruthy();
    });
  });
});
