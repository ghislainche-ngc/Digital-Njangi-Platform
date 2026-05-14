'use strict';

const { v4: uuidv4 } = require('uuid');
const PaymentProvider = require('./PaymentProvider');

const MOMO_BASE = 'https://sandbox.momodeveloper.mtn.com';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

/**
 * MTNMoMoService — MTN Mobile Money Collection & Disbursement API.
 *
 * OOP Pillars:
 *   - Inheritance: extends PaymentProvider (abstract base)
 *   - Polymorphism: overrides charge(), disburse(), getStatus(), refund()
 *   - Encapsulation: private _getCollectionToken(), _getDisbursementToken(), _pollStatus()
 *   - Abstraction: callers use charge(phone, amount) without knowing MoMo internals
 */
class MTNMoMoService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.subscriptionKey = config.subscriptionKey;
    this.apiUser = config.apiUser;
    this.apiKey = config.apiKey;
    this.targetEnv = config.targetEnv || 'sandbox';
    this.callbackUrl = config.callbackUrl || '';
  }

  /**
   * @private
   * Obtain a Bearer token from the Collection API using Basic Auth.
   */
  async _getCollectionToken() {
    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');

    const res = await fetch(`${MOMO_BASE}/collection/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MoMo Collection token failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  /**
   * @private
   * Obtain a Bearer token from the Disbursement API using Basic Auth.
   */
  async _getDisbursementToken() {
    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');

    const res = await fetch(`${MOMO_BASE}/disbursement/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MoMo Disbursement token failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  /**
   * @private
   * Poll a MoMo endpoint until the transaction resolves or times out.
   * @returns {Promise<'SUCCESSFUL'|'FAILED'|'TIMEOUT'>}
   */
  async _pollStatus(endpoint, referenceId, token) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const res = await fetch(`${MOMO_BASE}${endpoint}/${referenceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status !== 'PENDING') return data.status;
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    return 'TIMEOUT';
  }

  /**
   * Debit a member's mobile wallet (collection).
   * @param {string} phone — E.164, e.g. +237677000001
   * @param {number} amount — amount in FCFA
   * @returns {Promise<{ success: boolean, externalRef: string, status: string }>}
   */
  async charge(phone, amount) {
    const token = await this._getCollectionToken();
    const referenceId = uuidv4();

    const res = await fetch(`${MOMO_BASE}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': this.targetEnv,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
        ...(this.callbackUrl && { 'X-Callback-Url': this.callbackUrl }),
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'EUR',
        externalId: referenceId,
        payer: { partyIdType: 'MSISDN', partyId: phone.replace('+', '') },
        payerMessage: 'NjangiBridge contribution payment',
        payeeNote: 'Njangi contribution',
      }),
    });

    if (!res.ok && res.status !== 202) {
      const body = await res.text();
      throw new Error(`MoMo charge request failed (${res.status}): ${body}`);
    }

    const status = await this._pollStatus(
      '/collection/v1_0/requesttopay',
      referenceId,
      token
    );

    return {
      success: status === 'SUCCESSFUL',
      externalRef: referenceId,
      status,
    };
  }

  /**
   * Credit a member's mobile wallet (disbursement / payout).
   * @param {string} phone — E.164
   * @param {number} amount — amount in FCFA
   * @returns {Promise<{ success: boolean, externalRef: string, status: string }>}
   */
  async disburse(phone, amount) {
    const token = await this._getDisbursementToken();
    const referenceId = uuidv4();

    const res = await fetch(`${MOMO_BASE}/disbursement/v1_0/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': this.targetEnv,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
        ...(this.callbackUrl && { 'X-Callback-Url': this.callbackUrl }),
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'EUR',
        externalId: referenceId,
        payee: { partyIdType: 'MSISDN', partyId: phone.replace('+', '') },
        payerMessage: 'NjangiBridge payout disbursement',
        payeeNote: 'Njangi payout',
      }),
    });

    if (!res.ok && res.status !== 202) {
      const body = await res.text();
      throw new Error(`MoMo disburse request failed (${res.status}): ${body}`);
    }

    const status = await this._pollStatus(
      '/disbursement/v1_0/transfer',
      referenceId,
      token
    );

    return {
      success: status === 'SUCCESSFUL',
      externalRef: referenceId,
      status,
    };
  }

  /**
   * Check status of a previously submitted collection request.
   * @param {string} externalRef — the X-Reference-Id from charge()
   * @returns {Promise<'SUCCESSFUL'|'FAILED'|'PENDING'>}
   */
  async getStatus(externalRef) {
    const token = await this._getCollectionToken();

    const res = await fetch(
      `${MOMO_BASE}/collection/v1_0/requesttopay/${externalRef}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MoMo getStatus failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.status;
  }

  /**
   * Refund is not natively supported by MoMo — use disbursement as workaround.
   */
  async refund(_externalRef) {
    throw new Error('MoMo does not support native refunds. Use disburse() instead.');
  }
}

module.exports = MTNMoMoService;
