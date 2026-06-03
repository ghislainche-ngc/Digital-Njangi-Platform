'use strict';

const { supabase } = require('../config/supabase');
const { resolvePayoutGateway } = require('../services/payment/phoneRouter');

/**
 * PayoutEngine — orchestrates the 5-step payout flow.
 *
 * Step 1: Run all 4 eligibility checks — ALL must pass or payout is BLOCKED
 * Step 2: Disburse funds via PaymentProvider (two-tier routing)
 * Step 3: Update ledger (mark payout complete)
 * Step 4: Advance the rotation calendar
 * Step 5: Notify all group members
 *
 * OOP: Demonstrates Dependency Injection and the Facade pattern.
 *
 * @task Dev B — Task B-04
 */
class PayoutEngine {
  constructor(contributionService, paymentFactory, notificationService, auditService, fineService) {
    this.contributionService = contributionService;
    this.paymentFactory = paymentFactory;
    this.notificationService = notificationService;
    this.auditService = auditService;
    this.fineService = fineService;
  }

  /**
   * Execute a full payout for a group and recipient.
   * @returns {Promise<{ success: boolean, payoutId?: string, reason?: string }>}
   */
  async execute(groupId, recipientId) {
    // Step 1 — Eligibility (all 4 checks run in parallel for speed)
    const eligibility = await this.checkEligibility(groupId, recipientId);
    if (!eligibility.passed) {
      await this._blockPayout(groupId, recipientId, eligibility.reason);
      return { success: false, reason: eligibility.reason };
    }

    // Load group, recipient, and pending payout for downstream steps
    const { supabase } = require('../config/supabase');
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('*')
      .eq('id', groupId)
      .single();
    const { data: recipient } = await supabase
      .from('users')
      .select('*')
      .eq('id', recipientId)
      .single();
    const { data: payout } = await supabase
      .from('payouts')
      .select('*')
      .eq('group_id', groupId)
      .eq('recipient_id', recipientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!group || !recipient || !payout) {
      return { success: false, reason: 'Missing group, recipient, or pending payout data' };
    }

    this.group = group;
    this.recipient = recipient;
    this.payout = payout;

    // Step 2 — Disburse via the two-tier router
    const disburseResult = await this._dispatchDisburse();

    // Step 3 — Update ledger (mark payout complete)
    await supabase
      .from('payouts')
      .update({
        status: disburseResult.success ? 'completed' : 'failed',
        external_ref: disburseResult.externalRef || null,
        completed_at: disburseResult.success ? new Date().toISOString() : null,
      })
      .eq('id', payout.id);

      // Step 4 — Advance rotation calendar.
      // Step 5 — Notify all members.
      await Promise.allSettled([
        this._advanceRotationCalendar(groupId),
        this._notifyGroupMembers(groupId, recipientId, disburseResult),
      ]);

    return {
      success: disburseResult.success,
      payoutId: payout.id,
      externalRef: disburseResult.externalRef,
      ...(!disburseResult.success && { reason: disburseResult.status }),
    };
  }

  /**
   * Run all 4 eligibility checks concurrently.
   * Returns the first failing check, or { passed: true }.
   */
  async checkEligibility(groupId, recipientId) {
    const checks = await Promise.all([
      this._checkPotCollected(groupId),
      this._checkNoUnpaidFines(groupId, recipientId),
      this._checkWalletLinked(recipientId),
      this._checkPresidentApproval(groupId, recipientId),
    ]);

    const failed = checks.find(c => !c.passed);
    return failed || { passed: true };
  }

  /**
   * @private
   * Two-tier payout routing.
   * Returns the provider's disburse result, or throws on routing failures.
   */
  async _dispatchDisburse() {
    const gateway = this.group?.preferred_payout_gateway
      || resolvePayoutGateway(this.recipient.phone);

    const provider = this.paymentFactory.getProvider(gateway);
    return provider.disburse(this.recipient.phone, this.payout.amount, this.payout.id);
  }

  async _checkPotCollected(groupId) {
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('payout_threshold_pct, contribution_amount')
      .eq('id', groupId)
      .single();

    const { data: cycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .single();

    if (!group || !cycle) {
      return { passed: false, reason: 'Group or active cycle not found' };
    }

    const { data: members } = await supabase
      .from('memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const { data: confirmed } = await supabase
      .from('contributions')
      .select('amount')
      .eq('cycle_id', cycle.id)
      .eq('group_id', groupId)
      .eq('status', 'confirmed');

    const totalExpected = (members?.length || 0) * Number(group.contribution_amount || 0);
    const totalCollected = (confirmed || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    const threshold = Number(group.payout_threshold_pct || 100);

    if (collectionRate < threshold) {
      return {
        passed: false,
        reason: `Collection rate ${Math.round(collectionRate)}% is below the ${threshold}% threshold.`,
      };
    }

    return { passed: true };
  }

  async _checkNoUnpaidFines(groupId, recipientId) {
    if (!this.fineService || typeof this.fineService.hasUnpaidFines !== 'function') {
      return { passed: true };
    }

    const hasUnpaidFines = await this.fineService.hasUnpaidFines(groupId, recipientId);
    if (hasUnpaidFines) {
      return { passed: false, reason: 'Recipient has unpaid fines.' };
    }

    return { passed: true };
  }

  async _checkWalletLinked(recipientId) {
    const { data: recipient } = await supabase
      .from('users')
      .select('phone')
      .eq('id', recipientId)
      .single();

    if (!recipient?.phone) {
      return { passed: false, reason: 'Recipient has no linked wallet/phone number.' };
    }

    return { passed: true };
  }

  async _checkPresidentApproval(groupId, recipientId) {
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('approval_threshold')
      .eq('id', groupId)
      .single();

    const { data: payout } = await supabase
      .from('payouts')
      .select('amount, approved_by, status')
      .eq('group_id', groupId)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!group || !payout) {
      return { passed: true };
    }

    const amount = Number(payout.amount || 0);
    const threshold = Number(group.approval_threshold || 0);

    if (amount > threshold && !payout.approved_by) {
      return {
        passed: false,
        reason: 'Payout above approval threshold requires president approval.',
      };
    }

    return { passed: true };
  }

  async _advanceRotationCalendar(groupId) {
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('frequency')
      .eq('id', groupId)
      .single();

    const { data: currentCycle } = await supabase
      .from('cycles')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('cycle_number', { ascending: false })
      .limit(1)
      .single();

    if (!group || !currentCycle) {
      return null;
    }

    const nextCycleNumber = Number(currentCycle.cycle_number || 0) + 1;

    const { data: existingNextCycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('group_id', groupId)
      .eq('cycle_number', nextCycleNumber)
      .single();

    if (!existingNextCycle) {
      const nextStart = this._addDays(currentCycle.end_date || new Date(), 1);
      const nextEnd = group.frequency === 'weekly'
        ? this._addDays(nextStart, 7)
        : group.frequency === 'biweekly'
        ? this._addDays(nextStart, 14)
        : this._addMonths(nextStart, 1);

      await supabase.from('cycles').insert({
        group_id: groupId,
        cycle_number: nextCycleNumber,
        start_date: this._toDateOnly(nextStart),
        end_date: this._toDateOnly(nextEnd),
        status: 'active',
      });
    }

    await supabase
      .from('cycles')
      .update({ status: 'completed' })
      .eq('id', currentCycle.id);

    return { cycleId: currentCycle.id, nextCycleNumber };
  }

  async _notifyGroupMembers(groupId, recipientId, disburseResult) {
    if (!this.notificationService || typeof this.notificationService.sendBulk !== 'function') {
      return null;
    }

    const { data: group } = await supabase
      .from('njangi_groups')
      .select('name')
      .eq('id', groupId)
      .single();

    const { data: members } = await supabase
      .from('memberships')
      .select('user_id, users(phone, full_name)')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const { data: recipient } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', recipientId)
      .single();

    const recipientName = recipient?.full_name || 'a member';
    const amount = Number(this.payout?.amount || 0);
    const message = disburseResult.success
      ? `Njangi ${group?.name || ''}: ${recipientName} received ${amount} FCFA.`
      : `Njangi ${group?.name || ''}: payout to ${recipientName} failed.`;

    const recipients = (members || [])
      .map((membership) => membership.users?.phone)
      .filter(Boolean);

    if (recipients.length === 0) {
      return null;
    }

    return this.notificationService.sendBulk(recipients, message, 'sms');
  }

  _addDays(dateValue, days) {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + days);
    return date;
  }

  _addMonths(dateValue, months) {
    const date = new Date(dateValue);
    date.setMonth(date.getMonth() + months);
    return date;
  }

  _toDateOnly(dateValue) {
    return new Date(dateValue).toISOString().split('T')[0];
  }

  async _blockPayout(groupId, recipientId, reason) {
    await this.auditService.log(groupId, recipientId, 'PAYOUT_BLOCKED', { reason });
  }
}

module.exports = PayoutEngine;
