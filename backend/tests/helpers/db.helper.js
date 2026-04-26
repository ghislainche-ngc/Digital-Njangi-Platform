'use strict';

const { supabase } = require('../../src/config/supabase');

/**
 * Database helpers for integration tests.
 * Always clean up test data after each test to prevent state leakage.
 *
 * @task Dev D — Task D-01
 */

/**
 * Delete all test users with email matching the test domain.
 * Call in afterEach or afterAll of integration tests.
 */
async function cleanTestUsers() {
  await supabase.from('users').delete().like('email', '%@naas.cm');
}

/**
 * Delete a specific group and all related data (memberships, cycles, etc.).
 */
async function cleanTestGroup(groupId) {
  if (!groupId) return;
  await supabase.from('memberships').delete().eq('group_id', groupId);
  await supabase.from('cycles').delete().eq('group_id', groupId);
  await supabase.from('njangi_groups').delete().eq('id', groupId);
}

module.exports = { cleanTestUsers, cleanTestGroup };
