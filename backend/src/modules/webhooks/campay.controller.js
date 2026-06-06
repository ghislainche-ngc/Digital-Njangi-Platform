'use strict';

const { verifyWebhookSignature } = require('../../services/payment/campaySignature');
const ContributionService = require('../../modules/contributions/contribution.service');

/**
 * Campay webhook handler.
 *
 * Campay sends a POST with a JSON body containing:
 *   { reference, status, amount, operator, operator_reference, ... }
 *
 * We verify the X-Campay-Signature header, then apply the terminal status
 * to the payment_transactions row and linked contribution.
 *
 * @route POST /webhooks/campay
 */
const handleCampayWebhook = async (req, res) => {
  try {
    const signature = req.get('X-Campay-Signature');
    if (!signature) {
      return res.status(401).json({ error: 'Missing X-Campay-Signature header' });
    }

    const isValid = verifyWebhookSignature(signature, process.env.APP_WEBHOOK_KEY);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { reference, status, amount } = req.body;

    if (!reference || !status) {
      return res.status(400).json({ error: 'Missing reference or status in payload' });
    }

    const result = await ContributionService.applyTerminalStatus(reference, status, {
      amount,
      gateway: 'campay',
      rawPayload: req.body,
    });

    return res.status(200).json({
      received: true,
      reference,
      status: result.status,
      contributionId: result.contributionId,
    });
  } catch (err) {
    // Never let webhook errors leak stack traces.
    // Return 500 so Campay retries (their retry policy is ~3 attempts).
    // eslint-disable-next-line no-console
    console.error('[CampayWebhook]', err.message);
    return res.status(500).json({ error: 'Internal processing error' });
  }
};

module.exports = { handleCampayWebhook };
