'use strict';

const express = require('express');
const router = express.Router();
const { handleCampayWebhook } = require('./campay.controller');

/**
 * @swagger
 * /webhooks/campay:
 *   post:
 *     summary: Campay payment webhook
 *     description: |
 *       Receives async payment status updates from Campay.
 *       The request body must include a valid X-Campay-Signature
 *       header signed with the configured APP_WEBHOOK_KEY.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference, status]
 *             properties:
 *               reference:
 *                 type: string
 *                 example: campay-ref-1
 *               status:
 *                 type: string
 *                 enum: [SUCCESSFUL, FAILED, PENDING]
 *                 example: SUCCESSFUL
 *               amount:
 *                 type: string
 *                 example: "5000"
 *               operator:
 *                 type: string
 *                 example: MTN
 *               operator_reference:
 *                 type: string
 *                 example: "00X"
 *     responses:
 *       200:
 *         description: Webhook processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received: { type: boolean, example: true }
 *                 reference: { type: string }
 *                 status: { type: string }
 *                 contributionId: { type: string, nullable: true }
 *       400: { description: Missing reference or status }
 *       401: { description: Missing or invalid signature }
 *       500: { description: Internal error (Campay will retry) }
 */
router.post('/campay', express.json(), handleCampayWebhook);

module.exports = router;
