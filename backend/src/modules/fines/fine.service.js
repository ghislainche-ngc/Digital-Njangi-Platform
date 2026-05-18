'use strict';

const { AuditEvents } = require('../../services/audit/AuditService');

/**
 * FineService — record, pay, and waive fines.
 *
 * Receives `db` (DBConnect instance) and `auditService` via dependency
 * injection so this module never imports config/supabase directly.
 *
 * @task Dev C — Task C-03
 */
class FineService {
  constructor(db, auditService) {
    this.db = db;
    this.auditService = auditService;
  }

  /**
   * Record a new unpaid fine against a member.
   * @returns {object} the created fine row
   */
  async recordFine(groupId, memberId, amount, reason, recordedBy) {
    if (amount <= 0) {
      const err = new Error('Fine amount must be greater than zero.');
      err.statusCode = 400;
      throw err;
    }
    if (!reason) {
      const err = new Error('A reason is required to record a fine.');
      err.statusCode = 400;
      throw err;
    }

    const rows = await this.db.create('fines', {
      group_id: groupId,
      user_id: memberId,
      amount,
      reason,
      applied_by: recordedBy,
      status: 'unpaid',
    });
    const fine = Array.isArray(rows) ? rows[0] : rows;

    await this.auditService.log(groupId, recordedBy, AuditEvents.FINE_APPLIED, {
      memberId,
      amount,
      reason,
    });

    return fine;
  }

  /**
   * Mark an existing fine as paid.
   * @returns {object} the updated fine row
   */
  async markPaid(fineId, paidBy, paymentMethod) {
    const fine = await this.db.findById('fines', fineId);
    if (!fine) {
      const err = new Error('Fine not found.');
      err.statusCode = 404;
      throw err;
    }

    const rows = await this.db.update(
      'fines',
      { id: fineId },
      { status: 'paid', resolved_at: new Date().toISOString() }
    );
    const updated = Array.isArray(rows) ? rows[0] : rows;

    await this.auditService.log(fine.group_id, paidBy, AuditEvents.FINE_PAID, {
      fineId,
      paymentMethod,
    });

    return updated;
  }

  /**
   * Waive a fine. A reason is mandatory.
   * @returns {object} the updated fine row
   */
  async waiveFine(fineId, waivedBy, reason) {
    if (!reason) {
      const err = new Error('A reason is required to waive a fine.');
      err.statusCode = 400;
      throw err;
    }

    const fine = await this.db.findById('fines', fineId);
    if (!fine) {
      const err = new Error('Fine not found.');
      err.statusCode = 404;
      throw err;
    }

    const rows = await this.db.update(
      'fines',
      { id: fineId },
      {
        status: 'waived',
        waived_by: waivedBy,
        waiver_reason: reason,
        resolved_at: new Date().toISOString(),
      }
    );
    const updated = Array.isArray(rows) ? rows[0] : rows;

    await this.auditService.log(fine.group_id, waivedBy, AuditEvents.FINE_WAIVED, {
      fineId,
      waivedBy,
      reason,
    });

    return updated;
  }

  /**
   * List all unpaid fines for a member within a group.
   * @returns {object[]}
   */
  async getMemberUnpaidFines(groupId, memberId) {
    return this.db.findAll('fines', {
      group_id: groupId,
      user_id: memberId,
      status: 'unpaid',
    });
  }

  /**
   * Used by PayoutEngine to block payout if recipient has unpaid fines.
   * @returns {boolean}
   */
  async hasUnpaidFines(groupId, memberId) {
    return (await this.getMemberUnpaidFines(groupId, memberId)).length > 0;
  }
}

module.exports = FineService;
