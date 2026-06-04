'use strict';

require('dotenv').config({ path: '.env.test' }); // load test DB creds if present
jest.setTimeout(30000);

/**
 * Integration tests for the auth endpoints (Supertest).
 *
 * SKIP-GUARDED: these tests require a live test database. When no test DB is
 * configured (no SUPABASE_URL / JWT_SECRET), the whole suite is skipped
 * cleanly with zero failures.
 *
 * NOTE: `src/app.js` calls `config/env` on import, which throws when env vars
 * are missing — so `app` (and the db helper, which imports `config/supabase`)
 * is required lazily inside `beforeAll`, never at the top level.
 */

const hasTestDb = Boolean(process.env.SUPABASE_URL && process.env.JWT_SECRET);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Auth API', () => {
  let request;
  let app;
  let cleanTestUsers;

  beforeAll(() => {
    request = require('supertest');
    app = require('../../src/app');
    ({ cleanTestUsers } = require('../helpers/db.helper'));
  });

  afterAll(async () => {
    if (cleanTestUsers) await cleanTestUsers();
  });

  // Build a unique, valid registration payload for each call.
  const buildUser = (overrides = {}) => {
    const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const randomPhone = `+2376${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
    return {
      email: `register-${unique}@naas.cm`,
      phone: randomPhone,
      full_name: 'Test User',
      password: 'SecurePass123!',
      language: 'en',
      ...overrides,
    };
  };

  describe('POST /auth/register', () => {
    it('returns 201 and a success message on a valid new registration', async () => {
      const payload = buildUser();
      const res = await request(app).post('/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('userId');
      expect(typeof res.body.userId).toBe('string');
    });

    it('returns 409 when the email already exists', async () => {
      const payload = buildUser();

      const first = await request(app).post('/auth/register').send(payload);
      expect(first.status).toBe(201);

      // Re-register the same email (use a fresh phone so email is the conflict).
      const duplicate = await request(app)
        .post('/auth/register')
        .send(buildUser({ email: payload.email }));

      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toHaveProperty('code', 'DUPLICATE_USER');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/auth/register').send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with a token on correct credentials', async () => {
      const payload = buildUser();

      const reg = await request(app).post('/auth/register').send(payload);
      expect(reg.status).toBe(201);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: payload.email, password: payload.password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', payload.email);
    });

    it('returns 401 on a wrong password', async () => {
      const payload = buildUser();

      const reg = await request(app).post('/auth/register').send(payload);
      expect(reg.status).toBe(201);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: payload.email, password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
  });

  describe('GET /health', () => {
    it('returns 200 with status: ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
