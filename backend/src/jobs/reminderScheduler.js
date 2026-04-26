'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');

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
    // TODO (Dev B):
    // 1. Find groups whose next payment day is tomorrow
    // 2. For each group, send paymentReminder notification to all members
    //    via notificationService.sendBulk(memberIds, templates.paymentReminder(...))
    const { data: _groups } = await supabase.from('njangi_groups').select('id').eq('status', 'active');

    // placeholder — implement above
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Reminder Scheduler] Error:', err.message);
  }
});
