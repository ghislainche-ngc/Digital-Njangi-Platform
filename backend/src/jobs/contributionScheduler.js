'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');

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
  // TODO (Dev B):
  // For each active member in group:
  // 1. Create contribution record (status: pending)
  // 2. Initiate MoMo deduction via ContributionService
  // 3. Log result to audit_events
  // 4. Notify member of deduction attempt
  void group;
}

module.exports = { _processGroupContributions };
