'use strict';

const { supabase } = require('../../config/supabase');
const { getProvider } = require('../../services/payment/index');
const { AuditService, AuditEvents } = require('../../services/audit/AuditService');
const RotationEngine = require('../../services/rotation/RotationEngine');
const FixedRotationStrategy = require('../../services/rotation/FixedRotationStrategy');
const RandomDrawStrategy = require('../../services/rotation/RandomDrawStrategy');
const PresidentDecisionStrategy = require('../../services/rotation/PresidentDecisionStrategy');

const auditService = new AuditService(supabase);

/**
 * PayoutService — 5-step payout engine with rotation integration.
 *
 * Payout lifecycle:
 *   1. Determine recipient (rotation or president nomination)
 *   2. Eligibility check (collection threshold met?)
 *   3. Create payout record (pending)
 *   4. President approves (approved)
 *   5. Treasurer executes (processing → completed/failed)
 *
 * OOP Pillars:
 *   - Abstraction: callers use determinNextRecipient() without knowing rotation internals
 *   - Encapsulation: private _checkEligibility, _resolveRotationStrategy
 *   - Dependency Injection: RotationEngine receives its strategy at runtime (Strategy pattern)
 *   - Facade: execute() coordinates payment provider + audit + status updates
 */
class PayoutService {
  /**
   * List all payouts for a group, optionally filtered.
   */
  async listPayouts(groupId, filters = {}) {
    let query = supabase
      .from('payouts')
      .select('*, users!payouts_recipient_id_fkey(full_name, phone, email), cycles(cycle_number)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (filters.cycleId) query = query.eq('cycle_id', filters.cycleId);
    if (filters.status) query = query.eq('status', filters.status);

    const offset = ((filters.page || 1) - 1) * (filters.limit || 20);
    query = query.range(offset, offset + (filters.limit || 20) - 1);

    const { data, error } = await query;
    if (error) throw this._dbError('listPayouts', error);
    return data;
  }

  /**
   * Get the current cycle's payout status (who is next, how much collected, etc.)
   */
  async getCurrentPayout(groupId) {
    const cycle = await this._getActiveCycle(groupId);
    if (!cycle) return { message: 'No active cycle', payout: null };

    const { data: payout } = await supabase
      .from('payouts')
      .select('*, users!payouts_recipient_id_fkey(full_name, phone)')
      .eq('cycle_id', cycle.id)
      .eq('group_id', groupId)
      .single();

    const eligibility = await this._checkEligibility(groupId, cycle.id);

    return {
      cycle: { id: cycle.id, number: cycle.cycle_number },
      payout: payout || null,
      eligibility,
    };
  }

  /**
   * Step 1: Determine the next recipient using the group's rotation strategy.
   * Creates a pending payout record.
   */
  async determineNextRecipient(groupId) {
    const cycle = await this._getActiveCycle(groupId);
    if (!cycle) {
      const err = new Error('No active cycle found.');
      err.statusCode = 400;
      err.code = 'NO_ACTIVE_CYCLE';
      throw err;
    }

    const { data: existingPayout } = await supabase
      .from('payouts')
      .select('id, status')
      .eq('cycle_id', cycle.id)
      .eq('group_id', groupId)
      .single();

    if (existingPayout) {
      const err = new Error('A payout already exists for this cycle.');
      err.statusCode = 409;
      err.code = 'PAYOUT_EXISTS';
      throw err;
    }

    const { data: group } = await supabase
      .from('njangi_groups')
      .select('rotation_type, contribution_amount')
      .eq('id', groupId)
      .single();

    const { data: members } = await supabase
      .from('memberships')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const { data: payoutHistory } = await supabase
      .from('payouts')
      .select('recipient_id, cycle_id')
      .eq('group_id', groupId)
      .in('status', ['completed', 'approved', 'processing']);

    const strategy = this._resolveRotationStrategy(group.rotation_type, cycle.cycle_number);

    if (group.rotation_type === 'president') {
      return { message: 'President must nominate a recipient.', requiresNomination: true };
    }

    const engine = new RotationEngine(strategy);
    const recipient = engine.selectNextRecipient(members, payoutHistory);

    if (!recipient) {
      const err = new Error('No eligible recipient found. All members may have received payouts.');
      err.statusCode = 400;
      err.code = 'NO_ELIGIBLE_RECIPIENT';
      throw err;
    }

    const totalAmount = (members?.length || 0) * group.contribution_amount;

    const { data: payout, error } = await supabase
      .from('payouts')
      .insert({
        cycle_id: cycle.id,
        recipient_id: recipient.user_id,
        group_id: groupId,
        amount: totalAmount,
        delivery_method: 'momo_mtn',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw this._dbError('determineNextRecipient', error);

    return payout;
  }

  /**
   * President manually nominates a recipient (president-decides rotation mode).
   */
  async nominate(groupId, recipientId, deliveryMethod, nominatedBy) {
    const cycle = await this._getActiveCycle(groupId);
    if (!cycle) {
      const err = new Error('No active cycle found.');
      err.statusCode = 400;
      err.code = 'NO_ACTIVE_CYCLE';
      throw err;
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('id, status')
      .eq('user_id', recipientId)
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single();

    if (!membership) {
      const err = new Error('Nominated user is not an active member of this group.');
      err.statusCode = 400;
      err.code = 'INVALID_RECIPIENT';
      throw err;
    }

    const { data: group } = await supabase
      .from('njangi_groups')
      .select('contribution_amount')
      .eq('id', groupId)
      .single();

    const { data: members } = await supabase
      .from('memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const totalAmount = (members?.length || 0) * group.contribution_amount;

    const { data: payout, error } = await supabase
      .from('payouts')
      .insert({
        cycle_id: cycle.id,
        recipient_id: recipientId,
        group_id: groupId,
        amount: totalAmount,
        delivery_method: deliveryMethod || 'momo_mtn',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw this._dbError('nominate', error);

    await auditService.log(groupId, nominatedBy, 'PAYOUT_NOMINATED', {
      payoutId: payout.id,
      recipientId,
      amount: totalAmount,
    });

    return payout;
  }

  /**
   * Step 4: President approves a pending payout.
   */
  async approve(groupId, payoutId, approvedBy) {
    const { data: payout, error: fetchErr } = await supabase
      .from('payouts')
      .select('*')
      .eq('id', payoutId)
      .eq('group_id', groupId)
      .single();

    if (fetchErr || !payout) {
      const err = new Error('Payout not found.');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (payout.status !== 'pending') {
      const err = new Error(`Cannot approve payout in '${payout.status}' status.`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS';
      throw err;
    }

    const eligibility = await this._checkEligibility(groupId, payout.cycle_id);
    if (!eligibility.eligible) {
      await supabase
        .from('payouts')
        .update({ status: 'blocked' })
        .eq('id', payoutId);

      await auditService.log(groupId, approvedBy, AuditEvents.PAYOUT_BLOCKED, {
        payoutId,
        reason: eligibility.reason,
        collectionRate: eligibility.collectionRate,
      });

      const err = new Error(eligibility.reason);
      err.statusCode = 400;
      err.code = 'THRESHOLD_NOT_MET';
      throw err;
    }

    const { data, error } = await supabase
      .from('payouts')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', payoutId)
      .select();

    if (error) throw this._dbError('approve', error);

    await auditService.log(groupId, approvedBy, 'PAYOUT_APPROVED', {
      payoutId,
      recipientId: payout.recipient_id,
      amount: payout.amount,
    });

    return data[0];
  }

  /**
   * Step 5: Treasurer executes an approved payout — disburse via payment gateway.
   */
  async execute(groupId, payoutId, executedBy, deliveryMethod) {
    const { data: payout, error: fetchErr } = await supabase
      .from('payouts')
      .select('*, users!payouts_recipient_id_fkey(phone, full_name)')
      .eq('id', payoutId)
      .eq('group_id', groupId)
      .single();

    if (fetchErr || !payout) {
      const err = new Error('Payout not found.');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (payout.status !== 'approved') {
      const err = new Error(`Cannot execute payout in '${payout.status}' status. Must be approved first.`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS';
      throw err;
    }

    const method = deliveryMethod || payout.delivery_method;

    if (method === 'cash' || method === 'bank') {
      const { data, error } = await supabase
        .from('payouts')
        .update({
          status: 'completed',
          delivery_method: method,
          executed_at: new Date().toISOString(),
        })
        .eq('id', payoutId)
        .select();

      if (error) throw this._dbError('execute (cash)', error);

      await auditService.log(groupId, executedBy, AuditEvents.PAYOUT_EXECUTED, {
        payoutId,
        recipientId: payout.recipient_id,
        amount: payout.amount,
        method,
      });

      return data[0];
    }

    await supabase
      .from('payouts')
      .update({ status: 'processing', delivery_method: method })
      .eq('id', payoutId);

    // Resolve gateway: group-level override first, then phone-prefix fallback.
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('preferred_payout_gateway')
      .eq('id', groupId)
      .single();

    let gatewayKey;
    if (group?.preferred_payout_gateway) {
      gatewayKey = group.preferred_payout_gateway;
    } else {
      gatewayKey = method === 'momo_orange' ? 'orange_money' : 'mtn_momo';
    }

    const provider = getProvider(gatewayKey);
    let result;

    try {
      result = await provider.disburse(payout.users.phone, Number(payout.amount));
    } catch (disbErr) {
      result = { success: false, externalRef: null, status: 'FAILED' };
    }

    await supabase.from('payment_transactions').insert({
      reference_type: 'payout',
      reference_id: payoutId,
      gateway: gatewayKey,
      external_ref: result.externalRef,
      phone: payout.users.phone,
      amount: payout.amount,
      direction: 'credit',
      status: result.success ? 'success' : 'failed',
    });

    const finalStatus = result.success ? 'completed' : 'failed';
    const { data, error } = await supabase
      .from('payouts')
      .update({
        status: finalStatus,
        ...(result.success && { executed_at: new Date().toISOString() }),
      })
      .eq('id', payoutId)
      .select();

    if (error) throw this._dbError('execute (update)', error);

    const eventType = result.success ? AuditEvents.PAYOUT_EXECUTED : AuditEvents.PAYOUT_FAILED;
    await auditService.log(groupId, executedBy, eventType, {
      payoutId,
      recipientId: payout.recipient_id,
      amount: payout.amount,
      method,
      externalRef: result.externalRef,
      gatewayStatus: result.status,
    });

    return {
      ...data[0],
      gatewayResult: {
        success: result.success,
        externalRef: result.externalRef,
        status: result.status,
      },
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

  async _checkEligibility(groupId, cycleId) {
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('payout_threshold_pct, contribution_amount')
      .eq('id', groupId)
      .single();

    const { data: members } = await supabase
      .from('memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const { data: confirmed } = await supabase
      .from('contributions')
      .select('amount')
      .eq('cycle_id', cycleId)
      .eq('group_id', groupId)
      .eq('status', 'confirmed');

    const totalExpected = (members?.length || 0) * (group?.contribution_amount || 0);
    const totalCollected = (confirmed || []).reduce((s, c) => s + Number(c.amount), 0);
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    const threshold = group?.payout_threshold_pct || 100;

    return {
      eligible: collectionRate >= threshold,
      collectionRate: Math.round(collectionRate),
      threshold,
      totalCollected,
      totalExpected,
      reason: collectionRate < threshold
        ? `Collection rate ${Math.round(collectionRate)}% is below the ${threshold}% threshold.`
        : null,
    };
  }

  _resolveRotationStrategy(rotationType, cycleNumber) {
    switch (rotationType) {
      case 'fixed':     return new FixedRotationStrategy(cycleNumber);
      case 'random':    return new RandomDrawStrategy();
      case 'president': return new PresidentDecisionStrategy();
      default:          return new FixedRotationStrategy(cycleNumber);
    }
  }

  _dbError(operation, error) {
    const err = new Error(`[PayoutService] ${operation} failed: ${error.message}`);
    err.statusCode = 500;
    err.code = 'DB_ERROR';
    return err;
  }
}

module.exports = new PayoutService();
