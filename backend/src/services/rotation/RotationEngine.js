'use strict';

/**
 * RotationEngine — context class for the Strategy pattern.
 * The strategy is injected at runtime based on the group's rotation_type.
 *
 * @task Dev B — Task B-03
 */
class RotationEngine {
  /**
   * @param {RotationStrategy} strategy — injected concrete strategy
   */
  constructor(strategy) {
    this.strategy = strategy;
  }

  /**
   * @param {Array} members — active memberships
   * @param {Array} payoutHistory — payouts made this cycle
   * @returns {object|null}
   */
  selectNextRecipient(members, payoutHistory) {
    return this.strategy.selectNextRecipient(members, payoutHistory);
  }
}

module.exports = RotationEngine;
