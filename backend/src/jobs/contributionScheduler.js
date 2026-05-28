'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');
const ContributionService = require('../modules/contributions/contribution.service');
const { AuditService } = require('../services/audit/AuditService');
const { getNotificationService, templates } = require('../services/notification');

const contributionService = new ContributionService();
const auditService = new AuditService(supabase);
const notificationService = getNotificationService('sms');

const contributionGatewayMap = {
  mtn_momo: 'momo_mtn',
  orange_money: 'momo_orange',
  campay: 'campay',
};

/**
 * Monthly Contribution Scheduler
 * Runs at 8:00 AM Cameroon time (WAT = UTC+1) on the 1st of each month.
 * Cron: '0 7 1 * *' (7am UTC = 8am WAT)
 *
 * @task Dev B — Task B-05
 */
cron.schedule('0 7 1 * *', async () => {
  // eslint-disable-next-line no-console
  console.log('[Scheduler] Monthly contribution job starting…');

  try {
    const { data: groups, error } = await supabase
      .from('njangi_groups')
      .select('*, memberships(user_id, users(phone, telegram_chat_id))')
      .eq('status', 'active');

    if (error) throw error;

    for (const group of (groups || [])) {
      await _processGroupContributions(group);
    }

    // eslint-disable-next-line no-console
    console.log(`[Scheduler] Processed ${groups?.length ?? 0} groups.`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Scheduler] Fatal error:', err.message);
  }
});

async function _processGroupContributions(group) {
  const gateway = contributionGatewayMap[group.preferred_gateway] || 'momo_mtn';
  const activeMembers = (group.memberships || [])
    .filter((membership) => membership.status !== 'removed' && membership.users?.phone)
    .map((membership) => ({
      userId: membership.user_id,
      ...membership.users,
    }));

  for (const member of activeMembers) {
    try {
      const result = await contributionService.initiateMobilePayment(group.id, member.userId, gateway);

      await auditService.log(group.id, member.userId, 'CONTRIBUTION_DEDUCTION_ATTEMPTED', {
        status: result.status,
        contributionId: result.contributionId,
        gateway,
        externalRef: result.externalRef,
      });

      const message = result.status === 'confirmed'
        ? templates.paymentConfirmed(member.full_name || 'member', result.amount || group.contribution_amount)
        : templates.paymentFailed(member.full_name || 'member', result.amount || group.contribution_amount);

      await notificationService.sendBulk([member.phone], message, 'sms');
    } catch (err) {
      await auditService.log(group.id, member.userId, 'CONTRIBUTION_DEDUCTION_ERROR', {
        error: err.message,
        gateway,
      });
    }
  }
}

module.exports = { _processGroupContributions };
