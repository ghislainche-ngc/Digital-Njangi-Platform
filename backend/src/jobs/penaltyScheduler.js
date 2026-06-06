'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');
const FineService = require('../modules/fines/fine.service');
const { AuditService } = require('../services/audit/AuditService');
const { getNotificationService, templates } = require('../services/notification');

const fineService = new FineService(require('../config/supabase').db, new AuditService(supabase));
const notificationService = getNotificationService('sms');

/**
 * Penalty Scheduler
 * Runs daily at 10:00 AM WAT (9am UTC).
 * Checks for contributions past the grace period and applies daily fines.
 *
 * @task Dev B — Task B-05
 */
cron.schedule('0 9 * * *', async () => {
  // eslint-disable-next-line no-console
  console.log('[Penalty Scheduler] Checking for overdue contributions…');

  try {
    const { data: contributions, error } = await supabase
      .from('contributions')
      .select('id, user_id, group_id, cycle_id, created_at, cycles(end_date), users(phone, full_name), njangi_groups(name, penalty_per_day)')
      .eq('status', 'failed');

    if (error) throw error;

    const now = new Date();

    for (const contribution of (contributions || [])) {
      const group = contribution.njangi_groups;
      const user = contribution.users;
      const cycle = contribution.cycles;

      if (!group || !user || !cycle) continue;

      const dueDate = new Date(cycle.end_date);
      dueDate.setDate(dueDate.getDate() + 1);

      const msPerDay = 24 * 60 * 60 * 1000;
      const daysOverdue = Math.max(0, Math.floor((now - dueDate) / msPerDay));

      if (daysOverdue === 0 || Number(group.penalty_per_day || 0) <= 0) {
        continue;
      }

      const amount = daysOverdue * Number(group.penalty_per_day || 0);
      await fineService.recordFine(group.id, contribution.user_id, amount, 'Late payment', 'system');

      const message = templates.fineApplied(user.full_name || 'member', amount, `Late by ${daysOverdue} day(s)`);
      await notificationService.sendBulk([user.phone], message, 'sms');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Penalty Scheduler] Error:', err.message);
  }
});
