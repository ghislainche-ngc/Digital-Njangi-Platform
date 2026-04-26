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

// Suppress console.error noise in tests — still logged on failure
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
