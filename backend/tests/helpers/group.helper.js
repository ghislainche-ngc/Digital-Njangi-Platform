'use strict';

const { supabase } = require('../../src/config/supabase');
const { createTestToken } = require('./auth.helper');

/**
 * Group helpers for integration and security tests.
 *
 * @task Dev D — Task D-01
 */

/**
 * Create a test group with a president and optional members.
 * @returns {{ id, presidentId, members: [] }}
 */
async function createTestGroup(overrides = {}) {
  // Create president user
  const { data: president } = await supabase.from('users').insert({
    email: overrides.email || `president-${Date.now()}@naas.cm`,
    phone: overrides.phone || `+2376${Math.floor(10000000 + Math.random() * 89999999)}`,
    full_name: overrides.name || 'Test President',
  }).select().single();

  // Create group
  const { data: group } = await supabase.from('njangi_groups').insert({
    name: overrides.groupName || `Test Group ${Date.now()}`,
    contribution_amount: 10000,
    frequency: 'monthly',
    rotation_type: 'fixed',
    created_by: president.id,
  }).select().single();

  // Create president membership
  await supabase.from('memberships').insert({
    user_id: president.id,
    group_id: group.id,
    role: 'president',
    rotation_position: 1,
  });

  return {
    id: group.id,
    presidentId: president.id,
    members: [{ userId: president.id, role: 'president' }],
  };
}

/**
 * Get a signed JWT for a user ID.
 */
function getToken(userId, groupId) {
  return createTestToken({ id: userId, group_id: groupId });
}

module.exports = { createTestGroup, getToken };
