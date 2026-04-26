'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');

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
    // TODO (Dev B):
    // 1. Find contributions with status='failed' that are past grace period
    // 2. For each: calculate days overdue × group.penalty_per_day
    // 3. Call fineService.recordFine(groupId, memberId, amount, 'Late payment', 'system')
    // 4. Notify member of fine applied
    const { data: _overdue } = await supabase
      .from('contributions')
      .select('*')
      .eq('status', 'failed');

    // placeholder — implement above
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Penalty Scheduler] Error:', err.message);
  }
});
