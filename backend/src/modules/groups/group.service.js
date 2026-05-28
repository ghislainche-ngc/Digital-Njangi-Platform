'use strict';

const { supabase } = require('../../config/supabase');

class GroupService {
  async createGroup(userId, groupData) {
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

    const allowedFields = [
      'name', 'contribution_amount', 'frequency', 'rotation_type',
      'penalty_per_day', 'payout_threshold_pct', 'approval_threshold',
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
}

module.exports = new GroupService();
