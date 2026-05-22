'use strict';

/**
 * Row-Level Security / Tenant-Isolation test suite.
 *
 * Proves that a member of Group A cannot access Group B's data — a critical
 * multi-tenancy guarantee for the NAAS platform.
 *
 * SKIP-GUARDED: these tests require a live test database. When SUPABASE_URL and
 * JWT_SECRET are not configured (e.g. in CI without a test DB), the whole suite
 * is skipped cleanly with zero failures. Provide them via `.env.test` to run.
 *
 * NOTE: `src/app` (and the DB-backed helpers) throw on import when env vars are
 * missing, so they are required lazily inside `beforeAll` — never at top level.
 */

require('dotenv').config({ path: '.env.test' });

const hasTestDb = Boolean(process.env.SUPABASE_URL && process.env.JWT_SECRET);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Row-Level Security — Tenant Isolation', () => {
  let request, app, createTestGroup, getToken, cleanTestGroup;
  let groupA, groupB;

  beforeAll(async () => {
    request = require('supertest');
    app = require('../../src/app');
    ({ createTestGroup, getToken } = require('../helpers/group.helper'));
    ({ cleanTestGroup } = require('../helpers/db.helper'));

    groupA = await createTestGroup({ groupName: 'Group A' });
    groupB = await createTestGroup({ groupName: 'Group B' });
  });

  afterAll(async () => {
    if (cleanTestGroup) {
      await cleanTestGroup(groupA && groupA.id);
      await cleanTestGroup(groupB && groupB.id);
    }
  });

  // Helper: a valid Group A president token used against Group B URLs.
  const groupAToken = () => `Bearer ${getToken(groupA.presidentId, groupA.id)}`;

  it('Group A president cannot read Group B contributions', async () => {
    const res = await request(app)
      .get(`/groups/${groupB.id}/contributions`)
      .set('Authorization', groupAToken());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_A_MEMBER');
  });

  it('Group A president cannot read Group B ledger', async () => {
    const res = await request(app)
      .get(`/groups/${groupB.id}/reports/ledger`)
      .set('Authorization', groupAToken());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_A_MEMBER');
  });

  it('Group A president cannot nominate a Group B payout', async () => {
    const res = await request(app)
      .post(`/groups/${groupB.id}/payouts/nominate`)
      .set('Authorization', groupAToken())
      .send({ recipientId: groupB.presidentId });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_A_MEMBER');
  });

  it('Group A president cannot view Group B members', async () => {
    const res = await request(app)
      .get(`/groups/${groupB.id}/members`)
      .set('Authorization', groupAToken());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_A_MEMBER');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get(`/groups/${groupB.id}/contributions`);

    expect(res.status).toBe(401);
  });
});
