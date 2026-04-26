'use strict';

const RotationStrategy = require('./RotationStrategy');

/**
 * RandomDrawStrategy — randomly selects from members who haven't received
 * a payout in the current cycle.
 *
 * @task Dev B — Task B-03
 */
class RandomDrawStrategy extends RotationStrategy {
  selectNextRecipient(members, payoutHistory) {
    if (!members || members.length === 0) return null;

    // Filter out members who already received a payout this cycle
    const paidUserIds = new Set((payoutHistory || []).map(p => p.recipient_id));
    const eligible = members.filter(m => !paidUserIds.has(m.user_id));

    if (eligible.length === 0) return null; // all members have received

    const randomIndex = Math.floor(Math.random() * eligible.length);
    return eligible[randomIndex];
  }
}

module.exports = RandomDrawStrategy;
