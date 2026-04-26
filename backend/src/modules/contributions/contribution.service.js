'use strict';

const { supabase } = require('../../config/supabase');

/**
 * ContributionService — MoMo deductions, cash payments, retries.
 *
 * @task Dev B — Task B-02
 */
class ContributionService {
  constructor(paymentProvider, notificationService, auditService) {
    this.paymentProvider = paymentProvider;
    this.notificationService = notificationService;
    this.auditService = auditService;
  }

  /**
   * Initiate a MoMo deduction for a pending contribution.
   * Retries once automatically if first attempt fails.
   */
  async initiateMoMoDeduction(contributionId) {
    // TODO (Dev B):
    // 1. Get contribution record + member phone
    // 2. Get payment provider for their gateway (mtn/orange)
    // 3. provider.charge(phone, amount)
    // 4. Log in payment_transactions
    // 5. Update contribution status
    // 6. Trigger notification
    // 7. If failed, retry once
    throw new Error('Not implemented');
  }

  /**
   * Record a cash payment made by a member.
   * Fires FRAUD ALERT if Treasurer records their own payment.
   */
  async recordCashPayment(groupId, memberId, recordedBy) {
    // TODO (Dev B):
    // ANTI-FRAUD RULE — hardcoded, must never be bypassable:
    if (recordedBy === memberId) {
      // Fire fraud alert to President
      // await this.notificationService.send(presidentPhone, templates.fraudAlert(treasurerName));
      // await this.auditService.log(groupId, recordedBy, 'FRAUD_ALERT', { memberId });
    }
    throw new Error('Not implemented');
  }
}

module.exports = ContributionService;
