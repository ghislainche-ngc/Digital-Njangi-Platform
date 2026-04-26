'use strict';

/**
 * RotationStrategy — abstract base class for selecting the next payout recipient.
 *
 * OOP: Demonstrates the Strategy design pattern.
 * Three concrete strategies: Fixed, Random, PresidentDecides.
 *
 * @task Dev B — Task B-03
 */
class RotationStrategy {
  constructor() {
    if (new.target === RotationStrategy) {
      throw new Error('RotationStrategy is abstract.');
    }
  }

  /**
   * Select the next payout recipient.
   * @param {Array} members — active memberships with rotation_position
   * @param {Array} payoutHistory — payouts already made this cycle
   * @returns {object|null} — membership record, or null (awaiting nomination)
   */
  selectNextRecipient(_members, _payoutHistory) {
    throw new Error('selectNextRecipient() must be implemented by subclass.');
  }
}

module.exports = RotationStrategy;
