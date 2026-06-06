'use strict';

const { supabase } = require('../../config/supabase');
const { AuditService, AuditEvents } = require('../../services/audit/AuditService');

const auditService = new AuditService(supabase);

class MemberService {
  async _enforceSubscriptionMemberLimit(groupId) {
    const { data: group, error: fetchError } = await supabase
      .from('njangi_groups')
      .select('subscription_tier, subscription_status, subscription_expires_at')
      .eq('id', groupId)
      .single();

    if (fetchError || !group) {
      const e = new Error('Group not found');
      e.statusCode = 404;
      e.code = 'GROUP_NOT_FOUND';
      throw e;
    }

    const expiry = group.subscription_expires_at ? new Date(group.subscription_expires_at) : null;
    if (group.subscription_status !== 'active' || (expiry && expiry < new Date())) {
      const e = new Error('Your Njangi group space subscription is inactive or expired. Please renew in settings.');
      e.statusCode = 402;
      e.code = 'SUBSCRIPTION_EXPIRED';
      throw e;
    }

    const { count, error: countError } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active');

    if (countError) throw countError;

    const tier = group.subscription_tier || 'starter';
    if (tier === 'starter' && count >= 5) {
      const e = new Error('Starter plan member limit reached (Max 5 members). Please upgrade your plan in settings.');
      e.statusCode = 403;
      e.code = 'TIER_LIMIT_REACHED';
      throw e;
    }
    if (tier === 'growth' && count >= 20) {
      const e = new Error('Growth plan member limit reached (Max 20 members). Please upgrade your plan in settings.');
      e.statusCode = 403;
      e.code = 'TIER_LIMIT_REACHED';
      throw e;
    }
  }

  async inviteMember(groupId, phone, invitedBy) {
    await this._enforceSubscriptionMemberLimit(groupId);

    const { data: existing } = await supabase
      .from('invitations')
      .select('id')
      .eq('group_id', groupId)
      .eq('phone', phone)
      .eq('status', 'pending')
      .single();

    if (existing) {
      const err = new Error('An invitation for this phone number is already pending.');
      err.statusCode = 409;
      err.code = 'DUPLICATE_INVITE';
      throw err;
    }

    const { data: alreadyMember } = await supabase
      .from('memberships')
      .select('id')
      .eq('group_id', groupId)
      .in('status', ['active'])
      .eq('user_id', (await supabase.from('users').select('id').eq('phone', phone).single()).data?.id || 'none')
      .single();

    if (alreadyMember) {
      const err = new Error('This person is already a member of the group.');
      err.statusCode = 409;
      err.code = 'ALREADY_MEMBER';
      throw err;
    }

    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({ group_id: groupId, phone, invited_by: invitedBy })
      .select()
      .single();

    if (error) throw error;

    await auditService.log(groupId, invitedBy, AuditEvents.MEMBER_INVITED, { phone });

    return invitation;
  }

  async acceptInvite(token, userId) {
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (invError || !invitation) {
      const err = new Error('Invalid or already used invitation token.');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    await this._enforceSubscriptionMemberLimit(invitation.group_id);

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from('invitations').update({ status: 'expired' }).eq('id', invitation.id);
      const err = new Error('This invitation has expired.');
      err.statusCode = 400;
      err.code = 'EXPIRED_TOKEN';
      throw err;
    }

    const { count } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', invitation.group_id)
      .eq('status', 'active');

    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .insert({
        user_id: userId,
        group_id: invitation.group_id,
        role: 'member',
        rotation_position: (count || 0) + 1,
      })
      .select()
      .single();

    if (memError) throw memError;

    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id);

    await auditService.log(invitation.group_id, userId, AuditEvents.MEMBER_JOINED, {
      invitedBy: invitation.invited_by,
    });

    return membership;
  }

  async listMembers(groupId) {
    const { data, error } = await supabase
      .from('memberships')
      .select('*, users(id, email, phone, full_name)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('rotation_position', { ascending: true });

    if (error) throw error;
    return data;
  }

  async assignRole(groupId, targetUserId, newRole, requestedBy) {
    if (targetUserId === requestedBy) {
      const err = new Error('You cannot change your own role.');
      err.statusCode = 400;
      err.code = 'SELF_ROLE_CHANGE';
      throw err;
    }

    const { data: membership, error } = await supabase
      .from('memberships')
      .update({ role: newRole })
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) throw error;

    await auditService.log(groupId, requestedBy, AuditEvents.ROLE_CHANGED, {
      targetUserId,
      newRole,
    });

    return membership;
  }

  async removeMember(groupId, targetUserId, requestedBy) {
    const { data: requesterMembership } = await supabase
      .from('memberships')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', requestedBy)
      .eq('status', 'active')
      .single();

    if (targetUserId === requestedBy && requesterMembership?.role === 'president') {
      const err = new Error('President cannot remove themselves. Transfer the role first.');
      err.statusCode = 400;
      err.code = 'PRESIDENT_SELF_REMOVE';
      throw err;
    }

    const { data: membership, error } = await supabase
      .from('memberships')
      .update({ status: 'removed' })
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) throw error;

    await auditService.log(groupId, requestedBy, AuditEvents.MEMBER_REMOVED, {
      removedUserId: targetUserId,
    });

    return membership;
  }
}

module.exports = new MemberService();
