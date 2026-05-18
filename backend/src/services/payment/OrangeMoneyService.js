'use strict';

const { v4: uuidv4 } = require('uuid');
const PaymentProvider = require('./PaymentProvider');

/**
 * OrangeMoneyService — Orange Money payment integration for Cameroon.
 *
 * OOP Pillars:
 *   - Inheritance: extends PaymentProvider (abstract base)
 *   - Polymorphism: overrides charge(), disburse(), getStatus(), refund()
 *   - Encapsulation: private _getAccessToken() hides auth logic
 */
class OrangeMoneyService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.orange.com/orange-money-webpay/cm/v1';
    this.merchantKey = config.merchantKey || '';
  }

  /**
   * @private
   * Obtain an access token from Orange Money OAuth2.
   */
  async _getAccessToken() {
    const res = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Orange Money token failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  /**
   * Debit a subscriber's Orange Money wallet.
   * @param {string} phone — E.164 format
   * @param {number} amount — amount in FCFA
   * @returns {Promise<{ success: boolean, externalRef: string, status: string }>}
   */
  async charge(phone, amount) {
    const token = await this._getAccessToken();
    const externalRef = uuidv4();

    const res = await fetch(`${this.baseUrl}/webpayment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_key: this.merchantKey,
        currency: 'OUV',
        order_id: externalRef,
        amount: String(amount),
        return_url: '',
        cancel_url: '',
        notif_url: '',
        lang: 'fr',
        reference: `NAAS-${externalRef.slice(0, 8)}`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Orange Money charge failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return {
      success: data.status === 'SUCCESSFUL' || data.status === 'SUCCESS',
      externalRef,
      status: data.status || 'PENDING',
      paymentUrl: data.payment_url || null,
    };
  }

  /**
   * Orange Money disbursement (merchant payout to subscriber).
   */
  async disburse(phone, amount) {
    const token = await this._getAccessToken();
    const externalRef = uuidv4();

    const res = await fetch(`${this.baseUrl}/cashout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_key: this.merchantKey,
        currency: 'OUV',
        order_id: externalRef,
        amount: String(amount),
        subscriber_msisdn: phone.replace('+', ''),
        reference: `NAAS-PAYOUT-${externalRef.slice(0, 8)}`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Orange Money disburse failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return {
      success: data.status === 'SUCCESSFUL' || data.status === 'SUCCESS',
      externalRef,
      status: data.status || 'PENDING',
    };
  }

  /**
   * Check payment status by order ID.
   */
  async getStatus(externalRef) {
    const token = await this._getAccessToken();

    const res = await fetch(
      `${this.baseUrl}/webpayment/${externalRef}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Orange Money getStatus failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.status || 'PENDING';
  }

  async refund(_externalRef) {
    throw new Error('Orange Money does not support native refunds.');
  }
}

module.exports = OrangeMoneyService;
