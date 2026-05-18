'use strict';

require('dotenv').config({ path: '.env.test' });

/**
 * Global test helpers — available in every test file without imports.
 *
 * @task Dev D — Task D-01
 */
global.testUser = {
  email: 'test@naas.cm',
  phone: '+237600000001',
  full_name: 'Test User',
  password: 'TestPassword123!',
  language: 'en',
};

global.testGroup = {
  name: 'Test Njangi Group',
  contribution_amount: 10000,
  frequency: 'monthly',
  rotation_type: 'fixed',
  penalty_per_day: 500,
};

// Console suppression is handled per-test file where needed.
// This file runs via setupFiles (before test framework), so
// beforeEach/afterEach are not available here.
