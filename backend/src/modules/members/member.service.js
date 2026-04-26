'use strict';

/**
 * MemberService — invite, join, role management, and removal.
 *
 * @task Dev A — Task A-06
 */
class MemberService {
  async inviteMember(groupId, phone, invitedBy) {
    // TODO (Dev A): create invitation record with 7-day expiry token
    // Send invite via NotificationService (Telegram link)
    throw new Error('Not implemented');
  }

  async acceptInvite(token, userId) {
    // TODO (Dev A): validate token, create membership, mark token accepted
    throw new Error('Not implemented');
  }

  async listMembers(groupId) {
    // TODO (Dev A): return all active memberships with user details
    throw new Error('Not implemented');
  }

  async assignRole(groupId, targetUserId, newRole, requestedBy) {
    // TODO (Dev A): President can change roles; cannot demote self
    throw new Error('Not implemented');
  }

  async removeMember(groupId, targetUserId, requestedBy) {
    // TODO (Dev A): President removes; log to audit_events
    // Cannot remove self if president
    throw new Error('Not implemented');
  }
}

module.exports = new MemberService();
