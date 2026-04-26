'use strict';

const PaymentProvider = require('./PaymentProvider');

/**
 * OrangeMoneyService — Orange Money payment integration.
 *
 * @task Dev B — Task B-01
 */
class OrangeMoneyService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async charge(phone, amount) {
    // TODO (Dev B): Orange Money collection API
    void phone; void amount;
    throw new Error('Not implemented');
  }

  async disburse(phone, amount) {
    // TODO (Dev B): Orange Money disbursement API
    void phone; void amount;
    throw new Error('Not implemented');
  }

  async getStatus(externalRef) {
    void externalRef;
    throw new Error('Not implemented');
  }

  async refund(externalRef) {
    void externalRef;
    throw new Error('Not implemented');
  }
}

module.exports = OrangeMoneyService;
