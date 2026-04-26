'use strict';

/**
 * FineService — record, pay, and waive fines.
 *
 * @task Dev C — Task C-03
 */
class FineService {
  constructor(auditService) {
    this.auditService = auditService;
  }

  async recordFine(groupId, memberId, amount, reason, recordedBy) {
    // TODO (Dev C): insert into fines table
    throw new Error('Not implemented');
  }

  async markPaid(fineId, paidBy, paymentMethod) {
    // TODO (Dev C): update fine status to 'paid', log audit event
    throw new Error('Not implemented');
  }

  async waiveFine(fineId, waivedBy, reason) {
    // TODO (Dev C): waiver REQUIRES a reason — throw 400 if missing
    // Log in audit_events with waivedBy and reason
    if (!reason) {
      const err = new Error('A reason is required to waive a fine.');
      err.statusCode = 400;
      throw err;
    }
    throw new Error('Not implemented');
  }

  async getMemberUnpaidFines(groupId, memberId) {
    // TODO (Dev C): return list of unpaid fines for a member
    throw new Error('Not implemented');
  }

  /**
   * Used by PayoutEngine to block payout if recipient has unpaid fines.
   * @returns {boolean}
   */
  async hasUnpaidFines(groupId, memberId) {
    // TODO (Dev C): return true if any unpaid fine exists
    throw new Error('Not implemented');
  }
}

module.exports = FineService;
