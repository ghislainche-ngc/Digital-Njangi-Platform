'use strict';

/**
 * PayoutEngine — orchestrates the 5-step payout flow.
 *
 * Step 1: Run all 4 eligibility checks — ALL must pass or payout is BLOCKED
 * Step 2: Disburse funds via PaymentProvider
 * Step 3: Update ledger (mark payout complete)
 * Step 4: Advance the rotation calendar
 * Step 5: Notify all group members
 *
 * OOP: Demonstrates Dependency Injection and the Facade pattern.
 *
 * @task Dev B — Task B-04
 */
class PayoutEngine {
  constructor(contributionService, paymentProvider, notificationService, auditService, fineService) {
    this.contributionService = contributionService;
    this.paymentProvider = paymentProvider;
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

    // Step 2 — Disburse
    // TODO (Dev B): get recipient phone, get payout amount, call paymentProvider.disburse()
    // const result = await this.paymentProvider.disburse(recipient.phone, payout.amount);

    // Step 3 — Update ledger
    // TODO (Dev B): mark payout record as completed with externalRef

    // Step 4 — Advance rotation
    // TODO (Dev B): update cycle or create next cycle entry

    // Step 5 — Notify all members
    // TODO (Dev B): send payoutSent notification to every active member

    throw new Error('PayoutEngine.execute() — steps 2-5 not implemented');
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

  async _checkPotCollected(groupId) {
    // TODO (Dev B): verify that payout_threshold_pct of contributions are confirmed
    void groupId;
    return { passed: true }; // stub
  }

  async _checkNoUnpaidFines(groupId, recipientId) {
    // TODO (Dev B): call fineService.hasUnpaidFines(groupId, recipientId)
    void groupId; void recipientId;
    return { passed: true }; // stub
  }

  async _checkWalletLinked(recipientId) {
    // TODO (Dev B): verify recipient has a phone number linked (not null)
    void recipientId;
    return { passed: true }; // stub
  }

  async _checkPresidentApproval(groupId, recipientId) {
    // TODO (Dev B): if payout amount > group.approval_threshold, check approved_by IS NOT NULL
    void groupId; void recipientId;
    return { passed: true }; // stub
  }

  async _blockPayout(groupId, recipientId, reason) {
    await this.auditService.log(groupId, recipientId, 'PAYOUT_BLOCKED', { reason });
  }
}

module.exports = PayoutEngine;
