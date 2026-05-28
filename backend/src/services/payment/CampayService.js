'use strict';

const PaymentProvider = require('./PaymentProvider');
const { detectOperatorFromPhone } = require('./phoneRouter');

/**
 * CampayService — Cameroon mobile-money aggregator (https://campay.net).
 *
 * OOP Pillars:
 *   - Inheritance: extends PaymentProvider (abstract base).
 *   - Polymorphism: overrides charge(), disburse(), getStatus(), refund().
 *   - Encapsulation: private _getToken / _pollStatus / _normalizePhone.
 *   - Abstraction: callers use charge(phone, amount, ref) without knowing
 *     about Campay's JWT auth, token caching, or polling internals.
 */
class CampayService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.username = config.username;
    this.password = config.password;
    this.baseUrl = config.baseUrl || 'https://demo.campay.net/api';
    this._token = null;
    this._tokenExpiresAt = 0; // unix ms
  }

  /**
   * @private
   * Strip the '+' prefix from an E.164 Cameroon number.
   * Throws .statusCode=400 if the number is not a Cameroon number.
   */
  _normalizePhone(phone) {
    if (detectOperatorFromPhone(phone) === null) {
      const err = new Error(`Unsupported phone for Campay: ${phone ? phone.slice(0, 6) + '***' : 'undefined'}`);
      err.statusCode = 400;
      throw err;
    }
    return phone.replace(/^\+/, '');
  }

  async charge(_phone, _amount, _paymentRef) {
    throw new Error('CampayService.charge() not yet implemented');
  }

  async disburse(_phone, _amount, _paymentRef) {
    throw new Error('CampayService.disburse() not yet implemented');
  }

  async getStatus(_externalRef) {
    throw new Error('CampayService.getStatus() not yet implemented');
  }

  async refund(_externalRef) {
    throw new Error('Campay does not support native refunds');
  }
}

module.exports = CampayService;
