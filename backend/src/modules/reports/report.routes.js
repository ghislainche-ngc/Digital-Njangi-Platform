'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Ledger, summaries, personal history, PDF export
 */

/**
 * @swagger
 * /groups/{groupId}/reports/ledger:
 *   get:
 *     summary: Get the full group financial ledger
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ledger entries returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/reports/ledger', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

/**
 * @swagger
 * /groups/{groupId}/reports/summary:
 *   get:
 *     summary: Get a financial summary for the group
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Group financial summary returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/reports/summary', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

/**
 * @swagger
 * /groups/{groupId}/reports/my-history:
 *   get:
 *     summary: Get the authenticated member's personal transaction history
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Personal history returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/reports/my-history', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

/**
 * @swagger
 * /groups/{groupId}/reports/export:
 *   post:
 *     summary: Generate and export a PDF report (President and Treasurer only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:      { type: string, enum: [ledger, summary], example: summary }
 *               from_date: { type: string, format: date, example: "2026-01-01" }
 *               to_date:   { type: string, format: date, example: "2026-06-30" }
 *     responses:
 *       200: { description: PDF report generated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
// PDF export — President and Treasurer only
router.post('/:groupId/reports/export', auth, tenant, requireRole('president', 'treasurer'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev C Task C-05' });
});

module.exports = router;
