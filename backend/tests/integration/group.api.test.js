'use strict';

require('dotenv').config({ path: '.env.test' }); // load test DB creds if present
jest.setTimeout(30000);

/**
 * Integration tests for the Groups & Members endpoints (Supertest).
 *
 * SKIP-GUARDED: these tests require a live test database. When no test DB is
 * configured (no SUPABASE_URL / JWT_SECRET), the whole suite is skipped
 * cleanly with zero failures.
 *
 * NOTE: `src/app.js` calls `config/env` on import, which throws when env vars
 * are missing — so `app` (and the DB-backed helpers, which import
 * `config/supabase`) are required lazily inside `beforeAll`, never at the top
 * level.
 *
 * Routers: group.routes and member.routes are both mounted under `/groups`.
 */

const hasTestDb = Boolean(process.env.SUPABASE_URL && process.env.JWT_SECRET);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Groups & Members API', () => {
  let request;
  let app;
  let supabase;
  let createTestGroup;
  let getToken;
  let cleanTestGroup;
  let cleanTestUsers;

  // Track group ids created during the run so afterAll can clean them up.
  const createdGroupIds = new Set();

  beforeAll(() => {
    request = require('supertest');
    app = require('../../src/app');
    ({ createTestGroup, getToken } = require('../helpers/group.helper'));
    ({ cleanTestGroup, cleanTestUsers } = require('../helpers/db.helper'));
    ({ supabase } = require('../../src/config/supabase'));
  });

  afterAll(async () => {
    for (const groupId of createdGroupIds) {
      // Best-effort cleanup of related rows the standard helper doesn't touch.
      try {
        await supabase.from('invitations').delete().eq('group_id', groupId);
      } catch (_) { /* ignore */ }
      await cleanTestGroup(groupId);
    }
    await cleanTestUsers();
  });

  /** Insert a bare test user and return its id. */
  const createUser = async (overrides = {}) => {
    const unique = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: overrides.email || `member-${unique}@naas.cm`,
        phone: overrides.phone || `+2376${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
        full_name: overrides.full_name || 'Test Member',
        password_hash: 'dummy-password-hash',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  /** Add an active membership row with a given role. */
  const addMembership = async (groupId, userId, role, rotationPosition) => {
    const { error } = await supabase.from('memberships').insert({
      user_id: userId,
      group_id: groupId,
      role,
      status: 'active',
      rotation_position: rotationPosition,
    });
    if (error) throw error;
  };

  /** Valid POST /groups body. */
  const buildGroupPayload = (overrides = {}) => ({
    name: `API Test Group ${Date.now()}${Math.floor(Math.random() * 1000)}`,
    contribution_amount: 10000,
    frequency: 'monthly',
    rotation_type: 'fixed',
    ...overrides,
  });

  // ───────────────────────────────────────────────────────────────────────
  // POST /groups
  // ───────────────────────────────────────────────────────────────────────
  describe('POST /groups', () => {
    it('creates a group and assigns the creator as president (201)', async () => {
      const creator = await createUser();
      const res = await request(app)
        .post('/groups')
        .set('Authorization', `Bearer ${getToken(creator.id)}`)
        .send(buildGroupPayload());

      expect(res.status).toBe(201);
      // group.service returns { group, membership, cycle }
      expect(res.body).toHaveProperty('group');
      expect(res.body.group).toHaveProperty('id');
      expect(res.body.group).toHaveProperty('created_by', creator.id);
      expect(res.body).toHaveProperty('membership');
      expect(res.body.membership).toHaveProperty('user_id', creator.id);
      expect(res.body.membership).toHaveProperty('role', 'president');

      createdGroupIds.add(res.body.group.id);
    });

    it('returns 400 when contribution_amount is missing', async () => {
      const creator = await createUser();
      const payload = buildGroupPayload();
      delete payload.contribution_amount;

      const res = await request(app)
        .post('/groups')
        .set('Authorization', `Bearer ${getToken(creator.id)}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for an invalid rotation_type', async () => {
      const creator = await createUser();
      const res = await request(app)
        .post('/groups')
        .set('Authorization', `Bearer ${getToken(creator.id)}`)
        .send(buildGroupPayload({ rotation_type: 'spinning-wheel' }));

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // PATCH /groups/:groupId
  // ───────────────────────────────────────────────────────────────────────
  describe('PATCH /groups/:groupId', () => {
    it('lets the president update the contribution amount (200)', async () => {
      const group = await createTestGroup({ groupName: `Patch Group ${Date.now()}` });
      createdGroupIds.add(group.id);

      // Upgrade to enterprise tier and delete active cycles to allow contribution_amount updates
      await supabase
        .from('njangi_groups')
        .update({ subscription_tier: 'enterprise' })
        .eq('id', group.id);
      await supabase.from('cycles').delete().eq('group_id', group.id);

      const res = await request(app)
        .patch(`/groups/${group.id}`)
        .set('Authorization', `Bearer ${getToken(group.presidentId, group.id)}`)
        .send({ contribution_amount: 25000 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', group.id);
      expect(Number(res.body.contribution_amount)).toBe(25000);
    });

    it('rejects a treasurer trying to update settings (403)', async () => {
      const group = await createTestGroup({ groupName: `Patch RBAC Group ${Date.now()}` });
      createdGroupIds.add(group.id);

      // Add a treasurer member to the group.
      const treasurer = await createUser();
      await addMembership(group.id, treasurer.id, 'treasurer', 2);

      const res = await request(app)
        .patch(`/groups/${group.id}`)
        .set('Authorization', `Bearer ${getToken(treasurer.id, group.id)}`)
        .send({ contribution_amount: 30000 });

      // requireRole('president') — treasurer is denied.
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });

    it('rejects changing rotation_type while a cycle is active (400)', async () => {
      // Create the group via the API so an active cycle is created
      // (group.service.createGroup inserts an active cycle). The
      // updateSettings service rejects rotation_type changes whenever an
      // active cycle exists -> 400 ROTATION_LOCKED.
      const creator = await createUser();
      const createRes = await request(app)
        .post('/groups')
        .set('Authorization', `Bearer ${getToken(creator.id)}`)
        .send(buildGroupPayload({ rotation_type: 'fixed' }));
      expect(createRes.status).toBe(201);

      const groupId = createRes.body.group.id;
      createdGroupIds.add(groupId);

      const { data: cycle } = await supabase
        .from('cycles')
        .select('id')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .single();

      await supabase.from('contributions').insert({
        cycle_id: cycle.id,
        user_id: creator.id,
        group_id: groupId,
        amount: 10000,
        status: 'confirmed',
        payment_method: 'cash',
        confirmed_at: new Date().toISOString(),
      });

      const res = await request(app)
        .patch(`/groups/${groupId}`)
        .set('Authorization', `Bearer ${getToken(creator.id, groupId)}`)
        .send({ rotation_type: 'random' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'ROTATION_LOCKED');
    });

    it('rejects changing contribution_amount while a cycle is active (400)', async () => {
      const creator = await createUser();
      const createRes = await request(app)
        .post('/groups')
        .set('Authorization', `Bearer ${getToken(creator.id)}`)
        .send(buildGroupPayload({ rotation_type: 'fixed', contribution_amount: 5000 }));
      expect(createRes.status).toBe(201);

      const groupId = createRes.body.group.id;
      createdGroupIds.add(groupId);

      const { data: cycle } = await supabase
        .from('cycles')
        .select('id')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .single();

      await supabase.from('contributions').insert({
        cycle_id: cycle.id,
        user_id: creator.id,
        group_id: groupId,
        amount: 5000,
        status: 'confirmed',
        payment_method: 'cash',
        confirmed_at: new Date().toISOString(),
      });

      const res = await request(app)
        .patch(`/groups/${groupId}`)
        .set('Authorization', `Bearer ${getToken(creator.id, groupId)}`)
        .send({ contribution_amount: 8000 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'CONTRIBUTION_AMOUNT_LOCKED');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // POST /groups/:groupId/invitations
  // ───────────────────────────────────────────────────────────────────────
  describe('POST /groups/:groupId/invitations', () => {
    it('lets the president invite a member by phone (201)', async () => {
      const group = await createTestGroup({ groupName: `Invite Group ${Date.now()}` });
      createdGroupIds.add(group.id);

      const invitePhone = `+2376${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
      const res = await request(app)
        .post(`/groups/${group.id}/invitations`)
        .set('Authorization', `Bearer ${getToken(group.presidentId, group.id)}`)
        .send({ phone: invitePhone });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('group_id', group.id);
      expect(res.body).toHaveProperty('phone', invitePhone);
    });

    it('rejects a plain member trying to invite (403)', async () => {
      const group = await createTestGroup({ groupName: `Invite RBAC Group ${Date.now()}` });
      createdGroupIds.add(group.id);

      // Add a plain member to the group.
      const member = await createUser();
      await addMembership(group.id, member.id, 'member', 2);

      const invitePhone = `+2376${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
      const res = await request(app)
        .post(`/groups/${group.id}/invitations`)
        .set('Authorization', `Bearer ${getToken(member.id, group.id)}`)
        .send({ phone: invitePhone });

      // requireRole('president', 'secretary') — a plain member is denied.
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });

    it('rejects a duplicate invitation for the same phone (409)', async () => {
      const group = await createTestGroup({ groupName: `Invite Dup Group ${Date.now()}` });
      createdGroupIds.add(group.id);

      const invitePhone = `+2376${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
      const token = `Bearer ${getToken(group.presidentId, group.id)}`;

      const first = await request(app)
        .post(`/groups/${group.id}/invitations`)
        .set('Authorization', token)
        .send({ phone: invitePhone });
      expect(first.status).toBe(201);

      const duplicate = await request(app)
        .post(`/groups/${group.id}/invitations`)
        .set('Authorization', token)
        .send({ phone: invitePhone });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toHaveProperty('code', 'DUPLICATE_INVITE');
    });
  });
});
