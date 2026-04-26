'use strict';

/**
 * AuditService — permanently log every financial action.
 * Audit logging must NEVER crash the main flow.
 *
 * @task Dev C — Task C-02
 */
class AuditService {
  constructor(supabaseClient) {
    this.db = supabaseClient;
  }

  /**
   * Log an event to audit_events. Silently ignores errors.
   * @param {string} groupId
   * @param {string} userId — the actor performing the action
   * @param {string} eventType — use AuditEvents constants below
   * @param {object} payload — any relevant context (amounts, reasons, etc.)
   */
  async log(groupId, userId, eventType, payload = {}) {
    const { error } = await this.db
      .from('audit_events')
      .insert({ group_id: groupId, user_id: userId, event_type: eventType, payload });

    if (error) {
      // Never crash the main flow — audit is best-effort
      // eslint-disable-next-line no-console
      console.error('[Audit] Failed to log event:', error.message);
    }
  }
}

/**
 * Event type constants — always use these, never raw strings.
 * Consistent event types make audit log queries reliable.
 */
const AuditEvents = {
  CONTRIBUTION_CONFIRMED:         'CONTRIBUTION_CONFIRMED',
  CONTRIBUTION_FAILED:            'CONTRIBUTION_FAILED',
  CASH_PAYMENT_RECORDED:          'CASH_PAYMENT_RECORDED',
  PAYOUT_EXECUTED:                'PAYOUT_EXECUTED',
  PAYOUT_BLOCKED:                 'PAYOUT_BLOCKED',
  FINE_APPLIED:                   'FINE_APPLIED',
  FINE_WAIVED:                    'FINE_WAIVED',
  FINE_PAID:                      'FINE_PAID',
  MEMBER_INVITED:                 'MEMBER_INVITED',
  MEMBER_JOINED:                  'MEMBER_JOINED',
  MEMBER_REMOVED:                 'MEMBER_REMOVED',
  ROLE_CHANGED:                   'ROLE_CHANGED',
  FRAUD_ALERT_SELF_CASH_PAYMENT:  'FRAUD_ALERT_SELF_CASH_PAYMENT',
  GROUP_SETTINGS_CHANGED:         'GROUP_SETTINGS_CHANGED',
  SOCIAL_FUND_DEPOSIT:            'SOCIAL_FUND_DEPOSIT',
  SOCIAL_FUND_WITHDRAWAL:         'SOCIAL_FUND_WITHDRAWAL',
  PDF_REPORT_GENERATED:           'PDF_REPORT_GENERATED',
};

module.exports = { AuditService, AuditEvents };
