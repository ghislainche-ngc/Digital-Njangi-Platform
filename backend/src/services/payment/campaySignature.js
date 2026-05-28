'use strict';

const jwt = require('jsonwebtoken');

/**
 * Verify a Campay webhook signature.
 *
 * Per Campay docs: the `signature` field on every payment notification is a JWT
 * signed with the app's webhook key (HS256, same scheme as the /token/ endpoint).
 * We pin the algorithm to prevent 'none' / algorithm confusion attacks.
 *
 * @param {string} signature   The 'signature' field from the webhook payload.
 * @param {string} webhookKey  Value of CAMPAY_WEBHOOK_KEY.
 * @returns {object|null}      Decoded JWT payload on success, null on any failure.
 */
function verifyWebhookSignature(signature, webhookKey) {
  if (!signature || typeof signature !== 'string') return null;
  if (!webhookKey || typeof webhookKey !== 'string') return null;
  try {
    return jwt.verify(signature, webhookKey, { algorithms: ['HS256'] });
  } catch (_err) {
    return null;
  }
}

module.exports = { verifyWebhookSignature };
