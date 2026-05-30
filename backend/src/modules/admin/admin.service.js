'use strict';

const { supabase } = require('../../config/supabase');

class AdminService {
  /**
   * Get global stats for the admin dashboard.
   */
  async getPlatformStats() {
    // 1. Total Groups
    const { count: totalGroups, error: groupError } = await supabase
      .from('njangi_groups')
      .select('*', { count: 'exact', head: true });

    if (groupError) throw groupError;

    // 2. Total Users
    const { count: totalUsers, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (userError) throw userError;

    // 3. Total Transaction Volume (successful debits)
    const { data: txs, error: txError } = await supabase
      .from('payment_transactions')
      .select('amount')
      .eq('status', 'success')
      .eq('direction', 'debit');

    if (txError) throw txError;
    const totalVolume = (txs || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    // 4. Monthly Recurring Revenue (MRR)
    const { data: groups, error: mrrError } = await supabase
      .from('njangi_groups')
      .select('subscription_tier, subscription_status');

    if (mrrError) throw mrrError;

    let mrr = 0;
    (groups || []).forEach(group => {
      if (group.subscription_status === 'active') {
        if (group.subscription_tier === 'growth') mrr += 5000;
        else if (group.subscription_tier === 'enterprise') mrr += 15000;
      }
    });

    return {
      totalGroups: totalGroups || 0,
      totalUsers: totalUsers || 0,
      totalVolume,
      mrr,
    };
  }

  /**
   * List all groups with active member counts and billing status.
   */
  async getPlatformGroups() {
    const { data: groups, error: groupsError } = await supabase
      .from('njangi_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (groupsError) throw groupsError;

    // Get member counts for each group
    const { data: memberships, error: memError } = await supabase
      .from('memberships')
      .select('group_id')
      .eq('status', 'active');

    if (memError) throw memError;

    const memberCounts = {};
    (memberships || []).forEach(m => {
      memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
    });

    // Get president info
    const { data: presidents, error: presError } = await supabase
      .from('memberships')
      .select('group_id, user_id, users(full_name, email)')
      .eq('role', 'president')
      .eq('status', 'active');

    if (presError) throw presError;

    const presidentMap = {};
    (presidents || []).forEach(p => {
      presidentMap[p.group_id] = {
        name: p.users?.full_name || 'N/A',
        email: p.users?.email || 'N/A',
      };
    });

    return groups.map(g => ({
      ...g,
      memberCount: memberCounts[g.id] || 0,
      president: presidentMap[g.id] || { name: 'Unknown', email: 'Unknown' },
    }));
  }

  /**
   * Force update subscription details.
   */
  async updateGroupSubscription(groupId, { subscription_tier, subscription_status, subscription_expires_at }) {
    const updateData = {};
    if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier;
    if (subscription_status !== undefined) updateData.subscription_status = subscription_status;
    if (subscription_expires_at !== undefined) updateData.subscription_expires_at = subscription_expires_at;

    const { data: group, error } = await supabase
      .from('njangi_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    return group;
  }

  /**
   * Suspend or unsuspend group status.
   */
  async updateGroupStatus(groupId, status) {
    const { data: group, error } = await supabase
      .from('njangi_groups')
      .update({ status })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    return group;
  }

  /**
   * Get global transactions history with resolved names.
   */
  async getGlobalTransactions() {
    const { data: txs, error: txError } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (txError) throw txError;

    if (!txs || txs.length === 0) return [];

    // Collect reference IDs
    const contribIds = txs.filter(t => t.reference_type === 'contribution').map(t => t.reference_id);
    const payoutIds = txs.filter(t => t.reference_type === 'payout').map(t => t.reference_id);

    // Fetch details
    let contributions = [];
    if (contribIds.length > 0) {
      const { data } = await supabase
        .from('contributions')
        .select('id, group_id, user_id')
        .in('id', contribIds);
      contributions = data || [];
    }

    let payouts = [];
    if (payoutIds.length > 0) {
      const { data } = await supabase
        .from('payouts')
        .select('id, group_id, recipient_id')
        .in('id', payoutIds);
      payouts = data || [];
    }

    // Collect unique user and group IDs
    const groupIds = new Set();
    const userIds = new Set();

    contributions.forEach(c => {
      if (c.group_id) groupIds.add(c.group_id);
      if (c.user_id) userIds.add(c.user_id);
    });

    payouts.forEach(p => {
      if (p.group_id) groupIds.add(p.group_id);
      if (p.recipient_id) userIds.add(p.recipient_id);
    });

    // Fetch groups and users names
    let groups = [];
    if (groupIds.size > 0) {
      const { data } = await supabase
        .from('njangi_groups')
        .select('id, name')
        .in('id', Array.from(groupIds));
      groups = data || [];
    }

    let users = [];
    if (userIds.size > 0) {
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', Array.from(userIds));
      users = data || [];
    }

    // Map names
    const groupMap = {};
    groups.forEach(g => { groupMap[g.id] = g.name; });

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.full_name; });

    // Build lookup maps for references
    const refLookup = {};
    contributions.forEach(c => {
      refLookup[c.id] = {
        groupName: groupMap[c.group_id] || 'System',
        userName: userMap[c.user_id] || 'System',
      };
    });
    payouts.forEach(p => {
      refLookup[p.id] = {
        groupName: groupMap[p.group_id] || 'System',
        userName: userMap[p.recipient_id] || 'System',
      };
    });

    return txs.map(tx => {
      const resolved = refLookup[tx.reference_id] || { groupName: 'System', userName: 'System' };
      return {
        ...tx,
        groupName: resolved.groupName,
        userName: resolved.userName,
      };
    });
  }

  /**
   * List all registered users with their active memberships (group names and roles).
   */
  async getPlatformUsers() {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, phone, full_name, language, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (userError) throw userError;

    // Fetch all active memberships to map groups and roles
    const { data: memberships, error: memError } = await supabase
      .from('memberships')
      .select('user_id, role, njangi_groups(name)')
      .eq('status', 'active');

    if (memError) throw memError;

    // Group memberships by user_id
    const userMemberships = {};
    (memberships || []).forEach(m => {
      if (!userMemberships[m.user_id]) userMemberships[m.user_id] = [];
      userMemberships[m.user_id].push({
        role: m.role,
        groupName: m.njangi_groups?.name || 'N/A'
      });
    });

    return users.map(u => ({
      ...u,
      memberships: userMemberships[u.id] || [],
    }));
  }

  /**
   * Update a user's global admin role.
   */
  async updateUserRole(targetUserId, { is_admin }, requestedBy) {
    if (targetUserId === requestedBy && !is_admin) {
      const err = new Error('You cannot revoke your own administrator privileges.');
      err.statusCode = 400;
      err.code = 'SELF_DEMOTION';
      throw err;
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ is_admin: !!is_admin })
      .eq('id', targetUserId)
      .select('id, email, phone, full_name, language, is_admin, created_at')
      .single();

    if (error) throw error;
    return user;
  }

  /**
   * Permanently delete a user from the platform (subject to safety checks).
   */
  async deleteUser(targetUserId, requestedBy) {
    if (targetUserId === requestedBy) {
      const err = new Error('You cannot delete your own account.');
      err.statusCode = 400;
      err.code = 'SELF_DELETION';
      throw err;
    }

    // Check if the user is an active president of any group
    const { data: memberships, error: memError } = await supabase
      .from('memberships')
      .select('group_id')
      .eq('user_id', targetUserId)
      .eq('role', 'president')
      .eq('status', 'active');

    if (memError) throw memError;

    if (memberships && memberships.length > 0) {
      const err = new Error('User is the active President of a Njangi group. Transfer group presidency before deleting.');
      err.statusCode = 400;
      err.code = 'ACTIVE_PRESIDENT_DELETION';
      throw err;
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUserId);

    if (error) throw error;
    return { success: true };
  }
}

module.exports = new AdminService();
