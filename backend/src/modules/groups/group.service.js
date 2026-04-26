'use strict';

const { supabase } = require('../../config/supabase');

/**
 * GroupService — create and manage Njangi groups.
 *
 * @task Dev A — Task A-05
 */
class GroupService {
  /**
   * Create a new group. Assigns creator as President. Creates Cycle 1.
   */
  async createGroup(userId, groupData) {
    // TODO (Dev A): implement
    // 1. Insert into njangi_groups (created_by = userId)
    // 2. Insert membership: { user_id: userId, role: 'president', rotation_position: 1 }
    // 3. Insert first cycle: { cycle_number: 1, start_date: today, status: 'active' }
    throw new Error('Not implemented');
  }

  /**
   * Get a group with member count and current cycle.
   */
  async getGroup(groupId) {
    // TODO (Dev A): implement
    throw new Error('Not implemented');
  }

  /**
   * Update group settings. Blocks rotation type change mid-cycle.
   */
  async updateSettings(groupId, data) {
    // TODO (Dev A): implement
    // If rotation_type is being changed, check current cycle status
    throw new Error('Not implemented');
  }
}

module.exports = new GroupService();
