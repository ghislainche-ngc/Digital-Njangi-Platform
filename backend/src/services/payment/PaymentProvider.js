'use strict';

/**
 * PaymentProvider — abstract base class for payment gateways.
 *
 * OOP: This class demonstrates Abstraction and Inheritance.
 * MTNMoMoService and OrangeMoneyService extend this class and
 * provide concrete implementations of each method.
 *
 * @task Dev B — Task B-01
 */
class PaymentProvider {
  constructor(config) {
    if (new.target === PaymentProvider) {
      throw new Error('PaymentProvider is abstract and cannot be instantiated directly.');
    }
    this.config = config;
  }

  /**
   * Debit a member's mobile wallet (collection flow).
   * @param {string} phone — E.164 format, e.g. +237677000001
   * @param {number} amount — amount in FCFA
   * @returns {Promise<{ success: boolean, externalRef: string }>}
   */
  async charge(_phone, _amount) {
    throw new Error('charge() must be implemented by subclass.');
  }

  /**
   * Credit a member's mobile wallet (disbursement flow).
   * @returns {Promise<{ success: boolean, externalRef: string }>}
   */
  async disburse(_phone, _amount) {
    throw new Error('disburse() must be implemented by subclass.');
  }

  /**
   * Poll the payment gateway for a transaction's current status.
   * @returns {Promise<'SUCCESSFUL'|'FAILED'|'PENDING'>}
   */
  async getStatus(_externalRef) {
    throw new Error('getStatus() must be implemented by subclass.');
  }

  /**
   * Initiate a refund for a previously charged transaction.
   * @returns {Promise<{ success: boolean }>}
   */
  async refund(_externalRef) {
    throw new Error('refund() must be implemented by subclass.');
  }
}

module.exports = PaymentProvider;
