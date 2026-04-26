'use strict';

const RotationStrategy = require('./RotationStrategy');

/**
 * PresidentDecisionStrategy — President manually nominates the recipient.
 * Returns null to signal the PayoutEngine to wait for a nomination via the API.
 *
 * The PayoutEngine creates a payout record with status 'awaiting_nomination'.
 * The President then calls POST /groups/:groupId/payouts/nominate.
 *
 * @task Dev B — Task B-03
 */
class PresidentDecisionStrategy extends RotationStrategy {
  selectNextRecipient(_members, _payoutHistory) {
    // Signal: no automatic selection. Wait for President's nomination.
    return null;
  }
}

module.exports = PresidentDecisionStrategy;
