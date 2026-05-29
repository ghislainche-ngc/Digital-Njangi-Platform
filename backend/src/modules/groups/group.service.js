'use strict';

const { supabase } = require('../../config/supabase');

class GroupService {
  async listMyGroups(userId) {
    const { data: userRecord } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (userRecord && userRecord.is_admin) {
      const { data: groups, error: groupsError } = await supabase
        .from('njangi_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      return (groups || []).map((group) => ({
        id: group.id,
        role: 'admin',
        rotation_position: null,
        ...group,
      }));
    }

    const { data, error } = await supabase
      .from('memberships')
      .select('group_id, role, rotation_position, status, njangi_groups(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((membership) => ({
      id: membership.group_id,
      role: membership.role,
      rotation_position: membership.rotation_position,
      ...membership.njangi_groups,
    }));
  }

  async createGroup(userId, groupData) {
    const tier = groupData.subscription_tier || 'starter';
    const amount = Number(groupData.contribution_amount);

    if (tier === 'starter' && amount > 10000) {
      const err = new Error('Starter plan contribution amount cannot exceed 10,000 FCFA. Please upgrade to a higher plan.');
      err.statusCode = 400;
      err.code = 'TIER_LIMIT_BREACHED';
      throw err;
    }
    if (tier === 'growth' && amount > 100000) {
      const err = new Error('Growth plan contribution amount cannot exceed 100,000 FCFA. Please upgrade to Enterprise plan.');
      err.statusCode = 400;
      err.code = 'TIER_LIMIT_BREACHED';
      throw err;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const { data: group, error: groupError } = await supabase
      .from('njangi_groups')
      .insert({
        name: groupData.name,
        contribution_amount: groupData.contribution_amount,
        frequency: groupData.frequency || 'monthly',
        rotation_type: groupData.rotation_type,
        penalty_per_day: groupData.penalty_per_day || 0,
        payout_threshold_pct: groupData.payout_threshold_pct || 100,
        approval_threshold: groupData.approval_threshold || 0,
        subscription_tier: tier,
        subscription_expires_at: expiry.toISOString(),
        created_by: userId,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .insert({
        user_id: userId,
        group_id: group.id,
        role: 'president',
        rotation_position: 1,
      })
      .select()
      .single();

    if (memError) throw memError;

    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);

    const { data: cycle, error: cycleError } = await supabase
      .from('cycles')
      .insert({
        group_id: group.id,
        cycle_number: 1,
        start_date: today.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single();

    if (cycleError) throw cycleError;

    return { group, membership, cycle };
  }

  async getGroup(groupId) {
    const { data: group, error: groupError } = await supabase
      .from('njangi_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      const err = new Error('Group not found.');
      err.statusCode = 404;
      err.code = 'GROUP_NOT_FOUND';
      throw err;
    }

    const { count } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active');

    const { data: activeCycle } = await supabase
      .from('cycles')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single();

    return { ...group, memberCount: count || 0, activeCycle: activeCycle || null };
  }

  async updateSettings(groupId, data) {
    if (data.rotation_type) {
      const { data: activeCycle } = await supabase
        .from('cycles')
        .select('id')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .single();

      if (activeCycle) {
        const err = new Error('Cannot change rotation type while a cycle is active.');
        err.statusCode = 400;
        err.code = 'ROTATION_LOCKED';
        throw err;
      }
    }

    if (data.contribution_amount !== undefined || data.subscription_tier !== undefined) {
      const { data: current } = await supabase
        .from('njangi_groups')
        .select('subscription_tier, contribution_amount')
        .eq('id', groupId)
        .single();
      
      const newTier = data.subscription_tier !== undefined ? data.subscription_tier : (current?.subscription_tier || 'starter');
      const newAmount = data.contribution_amount !== undefined ? Number(data.contribution_amount) : (current?.contribution_amount || 0);

      if (newTier === 'starter' && newAmount > 10000) {
        const err = new Error('Starter plan contribution amount cannot exceed 10,000 FCFA. Please upgrade to a higher plan.');
        err.statusCode = 400;
        err.code = 'TIER_LIMIT_BREACHED';
        throw err;
      }
      if (newTier === 'growth' && newAmount > 100000) {
        const err = new Error('Growth plan contribution amount cannot exceed 100,000 FCFA. Please upgrade to Enterprise plan.');
        err.statusCode = 400;
        err.code = 'TIER_LIMIT_BREACHED';
        throw err;
      }
    }

    const allowedFields = [
      'name', 'contribution_amount', 'frequency', 'rotation_type',
      'penalty_per_day', 'payout_threshold_pct', 'approval_threshold',
      'subscription_tier',
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const { data: updated, error } = await supabase
      .from('njangi_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  async updateGateway(groupId, gateway) {
    if (!['mtn_momo', 'orange_money', 'campay'].includes(gateway)) {
      const e = new Error('invalid gateway');
      e.statusCode = 400;
      e.code = 'VALIDATION_ERROR';
      throw e;
    }

    const { data, error } = await supabase
      .from('njangi_groups')
      .update({ preferred_gateway: gateway })
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      const e = new Error('failed to update gateway');
      e.statusCode = 500;
      e.code = 'DB_ERROR';
      throw e;
    }
    if (!data) {
      const e = new Error('group not found');
      e.statusCode = 404;
      e.code = 'GROUP_NOT_FOUND';
      throw e;
    }
    return data;
  }

  async updatePayoutGateway(groupId, payoutGateway) {
    if (payoutGateway !== null &&
        !['mtn_momo', 'orange_money', 'campay'].includes(payoutGateway)) {
      const e = new Error('invalid payout gateway');
      e.statusCode = 400;
      e.code = 'VALIDATION_ERROR';
      throw e;
    }

    const { data, error } = await supabase
      .from('njangi_groups')
      .update({ preferred_payout_gateway: payoutGateway })
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      const e = new Error('failed to update payout gateway');
      e.statusCode = 500;
      e.code = 'DB_ERROR';
      throw e;
    }
    if (!data) {
      const e = new Error('group not found');
      e.statusCode = 404;
      e.code = 'GROUP_NOT_FOUND';
      throw e;
    }
    return data;
  }

  async renewSubscription(groupId, gateway) {
    const { data: group, error: fetchError } = await supabase
      .from('njangi_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (fetchError || !group) {
      const e = new Error('Group not found');
      e.statusCode = 404;
      e.code = 'GROUP_NOT_FOUND';
      throw e;
    }

    const planCosts = { starter: 0, growth: 5000, enterprise: 15000 };
    const cost = planCosts[group.subscription_tier] || 0;

    // Simulate payment transaction for paid tiers
    if (cost > 0) {
      if (!['mtn_momo', 'orange_money', 'campay'].includes(gateway)) {
        const e = new Error('Valid billing gateway required (mtn_momo, orange_money, or campay).');
        e.statusCode = 400;
        e.code = 'VALIDATION_ERROR';
        throw e;
      }
      // Here in production we'd invoke the PaymentProvider disburse/charge client
      // For this SaaS demo we auto-confirm the payment and record the audit trail
    }

    const currentExpiry = group.subscription_expires_at ? new Date(group.subscription_expires_at) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + 30);

    const { data: updated, error: updateError } = await supabase
      .from('njangi_groups')
      .update({
        subscription_status: 'active',
        subscription_expires_at: newExpiry.toISOString(),
      })
      .eq('id', groupId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }
}

module.exports = new GroupService();
