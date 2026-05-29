'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');
const { getNotificationService } = require('../services/notification');

const notificationService = getNotificationService('sms');

/**
 * Payment Reminder Scheduler
 * Runs daily at 9:00 AM WAT (8am UTC).
 * Sends reminders to members whose contribution is due tomorrow.
 *
 * @task Dev B — Task B-05
 */
cron.schedule('0 8 * * *', async () => {
  // eslint-disable-next-line no-console
  console.log('[Reminder Scheduler] Checking for upcoming payments…');

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = tomorrow.toISOString().split('T')[0];

    const { data: cycles, error } = await supabase
      .from('cycles')
      .select('id, group_id, end_date, njangi_groups(name, contribution_amount, memberships(user_id, status, users(phone, full_name)))')
      .eq('status', 'active')
      .eq('end_date', dueDate);

    if (error) throw error;

    for (const cycle of (cycles || [])) {
      const group = cycle.njangi_groups;
      const members = (group?.memberships || [])
        .filter((membership) => membership.status === 'active' && membership.users?.phone)
        .map((membership) => membership.users.phone);

      if (members.length === 0) continue;

      const message = `Reminder: ${group.name} contribution of ${group.contribution_amount} FCFA is due tomorrow (${dueDate}).`;
      await notificationService.sendBulk(members, message, 'sms');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Reminder Scheduler] Error:', err.message);
  }
});
