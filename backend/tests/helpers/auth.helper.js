'use strict';

const jwt = require('jsonwebtoken');

/**
 * Test helpers for authentication.
 * Use these in integration tests — don't repeat boilerplate.
 *
 * @task Dev D — Task D-01
 */

/**
 * Generate a valid JWT for a test user (no DB required).
 */
function createTestToken(overrides = {}) {
  const payload = {
    sub: overrides.id || 'test-user-id-001',
    email: overrides.email || 'test@naas.cm',
    role: overrides.role || 'member',
    group_id: overrides.group_id || null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
}

/**
 * Generate auth header value: "Bearer <token>"
 */
function bearerToken(overrides = {}) {
  return `Bearer ${createTestToken(overrides)}`;
}

module.exports = { createTestToken, bearerToken };
