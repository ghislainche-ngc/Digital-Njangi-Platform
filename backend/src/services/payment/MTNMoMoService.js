'use strict';

const { v4: uuidv4 } = require('uuid');
const PaymentProvider = require('./PaymentProvider');

const MOMO_BASE = 'https://sandbox.momodeveloper.mtn.com';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

/**
 * MTNMoMoService — MTN Mobile Money Collection & Disbursement API.
 *
 * Sandbox base URL: https://sandbox.momodeveloper.mtn.com
 * Set X-Target-Environment: sandbox header for all requests.
 *
 * @task Dev B — Task B-01
 */
class MTNMoMoService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.subscriptionKey = config.subscriptionKey;
    this.apiUser = config.apiUser;
    this.apiKey = config.apiKey;
    this.targetEnv = config.targetEnv || 'sandbox';
  }

  /**
   * Step 1: Get a Bearer token from the Collection API.
   */
  async _getCollectionToken() {
    // TODO (Dev B): POST /collection/token/ with Basic Auth
    // Return Bearer token string
    throw new Error('Not implemented');
  }

  async _getDisbursementToken() {
    // TODO (Dev B): POST /disbursement/token/ with Basic Auth
    throw new Error('Not implemented');
  }

  /**
   * Poll until status is SUCCESSFUL, FAILED, or timeout.
   */
  async _pollStatus(endpoint, referenceId, token) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      // TODO (Dev B): GET /collection/v1_0/requesttopay/{referenceId}
      // If status !== PENDING, return it
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    return 'TIMEOUT';
  }

  async charge(phone, amount) {
    // TODO (Dev B):
    // 1. _getCollectionToken()
    // 2. POST /collection/v1_0/requesttopay
    //    Headers: { Authorization: Bearer token, X-Reference-Id: uuidv4(),
    //               X-Target-Environment: sandbox, Ocp-Apim-Subscription-Key }
    //    Body: { amount, currency: 'EUR', externalId: uuidv4(), payer: { partyIdType: 'MSISDN', partyId: phone }, payerMessage, payeeNote }
    // 3. Poll until resolved
    const externalRef = uuidv4(); // placeholder until implemented
    void externalRef;
    void MOMO_BASE;
    throw new Error('Not implemented');
  }

  async disburse(phone, amount) {
    // TODO (Dev B): similar to charge but uses /disbursement/v1_0/transfer
    void phone; void amount;
    throw new Error('Not implemented');
  }

  async getStatus(externalRef) {
    // TODO (Dev B): GET /collection/v1_0/requesttopay/{externalRef}
    void externalRef;
    throw new Error('Not implemented');
  }

  async refund(_externalRef) {
    throw new Error('Not implemented');
  }
}

module.exports = MTNMoMoService;
