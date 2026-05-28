'use strict';

const { supabase } = require('../../config/supabase');
const { getProvider } = require('../../services/payment/index');
const { AuditService, AuditEvents } = require('../../services/audit/AuditService');
const { templates } = require('../../services/notification/index');

const auditService = new AuditService(supabase);

/**
 * ContributionService — handles MoMo deductions, cash payments, listing,
 * and retry logic for failed payments.
 *
 * OOP Pillars:
 *   - Encapsulation: internal helpers (_logTransaction, _getActiveCycle) hidden
 *   - Abstraction: callers use recordCashPayment() without knowing DB internals
 *   - Dependency Injection: payment provider is resolved via Factory at runtime
 */
class ContributionService {
  /**
   * List all contributions for a group, optionally filtered by cycle or status.
   */
  async listContributions(groupId, filters = {}) {
    let query = supabase
      .from('contributions')
      .select('*, users!contributions_user_id_fkey(full_name, phone, email)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (filters.cycleId) query = query.eq('cycle_id', filters.cycleId);
    if (filters.status) query = query.eq('status', filters.status);

    const offset = ((filters.page || 1) - 1) * (filters.limit || 20);
    query = query.range(offset, offset + (filters.limit || 20) - 1);

    const { data, error } = await query;
    if (error) throw this._dbError('listContributions', error);
    return data;
  }

  /**
   * Get the authenticated member's own contributions in a group.
   */
  async getMyContributions(groupId, userId) {
    const { data, error } = await supabase
      .from('contributions')
      .select('*, cycles(cycle_number, start_date, end_date)')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw this._dbError('getMyContributions', error);
    return data;
  }

  /**
   * Record a cash payment made by a member (Treasurer only).
   *
   * ANTI-FRAUD RULE: Treasurer cannot record their own cash payment.
   * This is hardcoded and must never be bypassed.
   */
  async recordCashPayment(groupId, memberId, recordedBy, amount, notes) {
    if (recordedBy === memberId) {
      await auditService.log(
        groupId,
        recordedBy,
        AuditEvents.FRAUD_ALERT_SELF_CASH_PAYMENT,
        { memberId, amount, notes }
      );

      const err = new Error('Treasurer cannot record their own cash payment.');
      err.statusCode = 403;
      err.code = 'FRAUD_SELF_PAYMENT';
      throw err;
    }

    const cycle = await this._getActiveCycle(groupId);
    if (!cycle) {
      const err = new Error('No active cycle found for this group.');
      err.statusCode = 400;
      err.code = 'NO_ACTIVE_CYCLE';
      throw err;
    }

    const { data: existing } = await supabase
      .from('contributions')
      .select('id, status')
      .eq('cycle_id', cycle.id)
      .eq('user_id', memberId)
      .single();

    if (existing && existing.status === 'confirmed') {
      const err = new Error('Member has already contributed for this cycle.');
      err.statusCode = 409;
      err.code = 'ALREADY_CONTRIBUTED';
      throw err;
    }

    if (existing) {
      const { data, error } = await supabase
        .from('contributions')
        .update({
          status: 'confirmed',
          payment_method: 'cash',
          amount,
          recorded_by: recordedBy,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select();

      if (error) throw this._dbError('recordCashPayment (update)', error);

      await auditService.log(groupId, recordedBy, AuditEvents.CASH_PAYMENT_RECORDED, {
        contributionId: existing.id,
        memberId,
        amount,
        notes,
      });

      return data[0];
    }

    const { data, error } = await supabase
      .from('contributions')
      .insert({
        cycle_id: cycle.id,
        user_id: memberId,
        group_id: groupId,
        amount,
        status: 'confirmed',
        payment_method: 'cash',
        recorded_by: recordedBy,
        confirmed_at: new Date().toISOString(),
      })
      .select();

    if (error) throw this._dbError('recordCashPayment (insert)', error);

    await auditService.log(groupId, recordedBy, AuditEvents.CASH_PAYMENT_RECORDED, {
      contributionId: data[0].id,
      memberId,
      amount,
      notes,
    });

    return data[0];
  }

  /**
   * Initiate a MoMo/Orange deduction for a pending contribution.
   * Creates the contribution record if it doesn't exist, then charges the wallet.
   * Retries once automatically on first failure.
   */
  async initiateMobilePayment(groupId, userId, gateway) {
    const cycle = await this._getActiveCycle(groupId);
    if (!cycle) {
      const err = new Error('No active cycle found for this group.');
      err.statusCode = 400;
      err.code = 'NO_ACTIVE_CYCLE';
      throw err;
    }

    const { data: group } = await supabase
      .from('njangi_groups')
      .select('contribution_amount')
      .eq('id', groupId)
      .single();

    const amount = group.contribution_amount;

    const { data: user } = await supabase
      .from('users')
      .select('phone, full_name')
      .eq('id', userId)
      .single();

    let contribution = await this._getOrCreatePendingContribution(
      cycle.id, userId, groupId, amount, gateway
    );

    if (contribution.status === 'confirmed') {
      const err = new Error('Contribution already confirmed for this cycle.');
      err.statusCode = 409;
      err.code = 'ALREADY_CONTRIBUTED';
      throw err;
    }

    await supabase
      .from('contributions')
      .update({ status: 'processing' })
      .eq('id', contribution.id);

    const provider = getProvider(gateway === 'momo_orange' ? 'orange_money' : 'mtn_momo');
    let result;

    try {
      result = await provider.charge(user.phone, amount);
    } catch (chargeErr) {
      result = { success: false, externalRef: null, status: 'FAILED' };
    }

    await this._logTransaction({
      referenceType: 'contribution',
      referenceId: contribution.id,
      gateway: gateway === 'momo_orange' ? 'orange_money' : 'mtn_momo',
      externalRef: result.externalRef,
      phone: user.phone,
      amount,
      direction: 'debit',
      status: result.success ? 'success' : 'failed',
    });

    if (!result.success) {
      try {
        result = await provider.charge(user.phone, amount);
        await this._logTransaction({
          referenceType: 'contribution',
          referenceId: contribution.id,
          gateway: gateway === 'momo_orange' ? 'orange_money' : 'mtn_momo',
          externalRef: result.externalRef,
          phone: user.phone,
          amount,
          direction: 'debit',
          status: result.success ? 'success' : 'failed',
          attempts: 2,
        });
      } catch {
        result = { success: false, externalRef: null, status: 'FAILED' };
      }
    }

    const finalStatus = result.success ? 'confirmed' : 'failed';
    await supabase
      .from('contributions')
      .update({
        status: finalStatus,
        ...(result.success && { confirmed_at: new Date().toISOString() }),
      })
      .eq('id', contribution.id);

    const eventType = result.success
      ? AuditEvents.CONTRIBUTION_CONFIRMED
      : AuditEvents.CONTRIBUTION_FAILED;

    await auditService.log(groupId, userId, eventType, {
      contributionId: contribution.id,
      amount,
      gateway,
      externalRef: result.externalRef,
    });

    return {
      contributionId: contribution.id,
      status: finalStatus,
      externalRef: result.externalRef,
      amount,
    };
  }

  /**
   * Retry a previously failed contribution payment.
   */
  async retryPayment(groupId, contributionId, gateway, requestedBy) {
    const { data: contribution, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('id', contributionId)
      .eq('group_id', groupId)
      .single();

    if (error || !contribution) {
      const err = new Error('Contribution not found.');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (contribution.status === 'confirmed') {
      const err = new Error('Contribution already confirmed.');
      err.statusCode = 409;
      err.code = 'ALREADY_CONFIRMED';
      throw err;
    }

    return this.initiateMobilePayment(groupId, contribution.user_id, gateway);
  }

  /**
   * Get contribution statistics for a group's current cycle.
   */
  async getStats(groupId) {
    const cycle = await this._getActiveCycle(groupId);
    if (!cycle) return { totalExpected: 0, totalCollected: 0, pending: 0, failed: 0 };

    const { data: members } = await supabase
      .from('memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const { data: contributions } = await supabase
      .from('contributions')
      .select('status, amount')
      .eq('cycle_id', cycle.id);

    const { data: group } = await supabase
      .from('njangi_groups')
      .select('contribution_amount')
      .eq('id', groupId)
      .single();

    const totalExpected = (members?.length || 0) * (group?.contribution_amount || 0);
    const confirmed = contributions?.filter(c => c.status === 'confirmed') || [];
    const totalCollected = confirmed.reduce((sum, c) => sum + Number(c.amount), 0);
    const pending = contributions?.filter(c => c.status === 'pending').length || 0;
    const failed = contributions?.filter(c => c.status === 'failed').length || 0;

    return {
      cycleId: cycle.id,
      cycleNumber: cycle.cycle_number,
      totalMembers: members?.length || 0,
      totalExpected,
      totalCollected,
      pending,
      confirmed: confirmed.length,
      failed,
      collectionRate: totalExpected > 0
        ? Math.round((totalCollected / totalExpected) * 100)
        : 0,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────

  async _getActiveCycle(groupId) {
    const { data } = await supabase
      .from('cycles')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .single();

    return data || null;
  }

  async _getOrCreatePendingContribution(cycleId, userId, groupId, amount, paymentMethod) {
    const { data: existing } = await supabase
      .from('contributions')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .single();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('contributions')
      .insert({
        cycle_id: cycleId,
        user_id: userId,
        group_id: groupId,
        amount,
        status: 'pending',
        payment_method: paymentMethod,
      })
      .select()
      .single();

    if (error) throw this._dbError('_getOrCreatePendingContribution', error);
    return data;
  }

  async _logTransaction(txn) {
    await supabase.from('payment_transactions').insert({
      reference_type: txn.referenceType,
      reference_id: txn.referenceId,
      gateway: txn.gateway,
      external_ref: txn.externalRef,
      phone: txn.phone,
      amount: txn.amount,
      direction: txn.direction,
      status: txn.status,
      attempts: txn.attempts || 1,
    });
  }

  /**
   * Apply a terminal status from a payment provider (webhook or polling) to
   * the payment_transactions row and the linked contribution.
   *
   * This is the single source of truth for transitioning a payment from
   * PENDING → SUCCESSFUL / FAILED / TIMEOUT.
   *
   * @param {string} externalRef   — the provider's transaction reference
   * @param {string} terminalStatus — 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'
   * @param {object} meta          — optional { phone, amount, gateway, rawPayload }
   * @returns {Promise<{contributionId: string|null, status: string}>}
   */
  async applyTerminalStatus(externalRef, terminalStatus, meta = {}) {
    const validTerminals = ['SUCCESSFUL', 'FAILED', 'TIMEOUT'];
    if (!validTerminals.includes(terminalStatus)) {
      const err = new Error(`Invalid terminal status: ${terminalStatus}`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS';
      throw err;
    }

    // 1. Find the payment transaction by external_ref
    const { data: txn, error: txnErr } = await supabase
      .from('payment_transactions')
      .select('id, reference_id, reference_type, status')
      .eq('external_ref', externalRef)
      .single();

    if (txnErr || !txn) {
      const err = new Error(`Payment transaction not found for ref: ${externalRef}`);
      err.statusCode = 404;
      err.code = 'TXN_NOT_FOUND';
      throw err;
    }

    // 2. Idempotency: if already terminal, do nothing
    if (txn.status === 'SUCCESSFUL' || txn.status === 'FAILED' || txn.status === 'TIMEOUT') {
      return { contributionId: txn.reference_id, status: txn.status };
    }

    // 3. Update the payment transaction
    const { error: updateTxnErr } = await supabase
      .from('payment_transactions')
      .update({
        status: terminalStatus,
        ...(meta.phone && { phone: meta.phone }),
        ...(meta.amount && { amount: meta.amount }),
        ...(meta.gateway && { gateway: meta.gateway }),
        ...(meta.rawPayload && { raw_payload: meta.rawPayload }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id);

    if (updateTxnErr) throw this._dbError('applyTerminalStatus (txn)', updateTxnErr);

    // 4. If linked to a contribution, update that too
    if (txn.reference_type === 'contribution' && txn.reference_id) {
      const finalStatus = terminalStatus === 'SUCCESSFUL' ? 'confirmed' : 'failed';
      const { error: contribErr } = await supabase
        .from('contributions')
        .update({
          status: finalStatus,
          ...(finalStatus === 'confirmed' && { confirmed_at: new Date().toISOString() }),
        })
        .eq('id', txn.reference_id);

      if (contribErr) throw this._dbError('applyTerminalStatus (contribution)', contribErr);

      // 5. Audit log
      const eventType = terminalStatus === 'SUCCESSFUL'
        ? AuditEvents.CONTRIBUTION_CONFIRMED
        : AuditEvents.CONTRIBUTION_FAILED;
      await auditService.log(null, null, eventType, {
        contributionId: txn.reference_id,
        externalRef,
        terminalStatus,
        meta,
      });

      return { contributionId: txn.reference_id, status: finalStatus };
    }

    return { contributionId: null, status: terminalStatus };
  }

  _dbError(operation, error) {
    const err = new Error(`[ContributionService] ${operation} failed: ${error.message}`);
    err.statusCode = 500;
    err.code = 'DB_ERROR';
    return err;
  }
}

module.exports = new ContributionService();
