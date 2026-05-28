'use strict';

require('dotenv').config({ path: '.env.test' });

/**
 * Integration smoke tests for the backend.
 *
 * These tests are intentionally tiny: they prove the app boots and the
 * public endpoints respond without needing any seeded state.
 *
 * SKIP-GUARDED: the app imports the Supabase config on load, so we only
 * run this suite when the test environment is configured.
 */

const hasTestDb = Boolean(process.env.SUPABASE_URL && process.env.JWT_SECRET);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('Backend smoke tests', () => {
  let request;
  let app;

  beforeAll(() => {
    request = require('supertest');
    app = require('../../src/app');
  });

  it('returns ok from GET /health', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('serves the OpenAPI JSON from GET /api-docs.json', async () => {
    const res = await request(app).get('/api-docs.json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('openapi');
    expect(res.body).toHaveProperty('paths');
    expect(res.body.paths).toHaveProperty('/auth/login');
  });
});