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

  /**
   * @private
   * Get a Campay JWT, using in-memory cache when the cached token is still fresh.
   * Refreshes 5 min before stated expiry to absorb clock skew + network latency.
   */
  async _getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt - 5 * 60_000) {
      return this._token;
    }

    const res = await fetch(`${this.baseUrl}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Campay token request failed (${res.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }

    const data = await res.json();
    this._token = data.token;
    this._tokenExpiresAt = now + (data.expires_in * 1000);
    return this._token;
  }

  /**
   * @private
   * Poll GET /transaction/<reference>/ every 2 s, max 30 s. Returns the final
   * status string ('SUCCESSFUL' | 'FAILED' | 'TIMEOUT').
   */
  async _pollStatus(reference, token) {
    const POLL_INTERVAL_MS = 2_000;
    const POLL_TIMEOUT_MS = 30_000;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/transaction/${reference}/`, {
        method: 'GET',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.status !== 'PENDING') {
          return data.status; // 'SUCCESSFUL' or 'FAILED'
        }
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    return 'TIMEOUT';
  }

  /**
   * Debit a Cameroon mobile-money wallet.
   * @param {string} phone        — E.164, +237...
   * @param {number} amount       — integer XAF
   * @param {string} paymentRef   — caller's idempotent reference (e.g. contribution UUID)
   * @returns {Promise<{success: boolean, externalRef: string, status: string}>}
   */
  async charge(phone, amount, paymentRef) {
    const normalized = this._normalizePhone(phone);
    const token = await this._getToken();

    let sendAmount = amount;
    if (this.baseUrl.includes('demo.campay.net') && amount > 25 && process.env.NODE_ENV !== 'test') {
      sendAmount = 25;
    }

    const collectRes = await fetch(`${this.baseUrl}/collect/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(sendAmount),
        currency: 'XAF',
        from: normalized,
        description: 'NjangiBridge contribution',
        external_reference: `${paymentRef}-${Date.now()}`,
      }),
    });

    if (!collectRes.ok) {
      const body = await collectRes.text();
      const err = new Error(`Campay /collect/ failed (${collectRes.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }

    const { reference } = await collectRes.json();
    const status = await this._pollStatus(reference, token);

    return {
      success: status === 'SUCCESSFUL',
      externalRef: reference,
      status, // 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'
    };
  }

  /**
   * Credit a mobile-money wallet (withdrawal / payout).
   * Requires "Withdrawals through the API" to be enabled in the Campay dashboard.
   *
   * @param {string} phone        — E.164, +237...
   * @param {number} amount       — integer XAF
   * @param {string} paymentRef   — caller's idempotent reference (e.g. payout UUID)
   * @returns {Promise<{success: boolean, externalRef: string, status: string}>}
   */
  async disburse(phone, amount, paymentRef) {
    const normalized = this._normalizePhone(phone);
    const token = await this._getToken();

    let sendAmount = amount;
    if (this.baseUrl.includes('demo.campay.net') && amount > 25 && process.env.NODE_ENV !== 'test') {
      sendAmount = 25;
    }

    const res = await fetch(`${this.baseUrl}/withdraw/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(sendAmount),
        to: normalized,
        description: 'NjangiBridge payout',
        external_reference: `${paymentRef}-${Date.now()}`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Campay /withdraw/ failed (${res.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }

    const { reference } = await res.json();
    const status = await this._pollStatus(reference, token);
    return {
      success: status === 'SUCCESSFUL',
      externalRef: reference,
      status,
    };
  }

  /**
   * Look up the current status of a Campay transaction.
   * @param {string} externalRef — the reference returned by charge/disburse
   * @returns {Promise<string>}  'SUCCESSFUL' | 'FAILED' | 'PENDING'
   */
  async getStatus(externalRef) {
    const token = await this._getToken();
    const res = await fetch(`${this.baseUrl}/transaction/${externalRef}/`, {
      method: 'GET',
      headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Campay /transaction/ failed (${res.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }
    const data = await res.json();
    return data.status;
  }

  async refund(_externalRef) {
    throw new Error('Campay does not support native refunds');
  }
}

module.exports = CampayService;
