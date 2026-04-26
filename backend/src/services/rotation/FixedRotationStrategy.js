'use strict';

const RotationStrategy = require('./RotationStrategy');

/**
 * FixedRotationStrategy — members receive payouts in a predetermined order.
 * Order is determined by memberships.rotation_position (1-based).
 *
 * For cycle N with M members: recipient is member at position ((N-1) % M) + 1
 *
 * @task Dev B — Task B-03
 */
class FixedRotationStrategy extends RotationStrategy {
  /**
   * @param {number} currentCycleNumber — 1-based cycle number
   */
  constructor(currentCycleNumber) {
    super();
    this.cycleNumber = currentCycleNumber;
  }

  selectNextRecipient(members, _payoutHistory) {
    if (!members || members.length === 0) return null;

    // Sort by rotation_position ascending
    const sorted = [...members].sort((a, b) => a.rotation_position - b.rotation_position);
    const index = (this.cycleNumber - 1) % sorted.length;
    return sorted[index];
  }
}

module.exports = FixedRotationStrategy;
