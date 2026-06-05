'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

const { db } = require('../../config/supabase');
const pdfService = require('../../services/pdf/PDFService');
const ReportService = require('./report.service');

const reportService = new ReportService(db, pdfService);

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
router.get('/:groupId/reports/ledger', auth, tenant, async (req, res) => {
  try {
    const ledger = await reportService.getLedger(req.params.groupId);
    res.json(ledger);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
  }
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
router.get('/:groupId/reports/summary', auth, tenant, async (req, res) => {
  try {
    const summary = await reportService.getSummary(req.params.groupId);
    res.json(summary);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
  }
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
router.get('/:groupId/reports/my-history', auth, tenant, async (req, res) => {
  try {
    const history = await reportService.getPersonalHistory(req.params.groupId, req.user.sub);
    res.json(history);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
  }
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
 *     responses:
 *       200: { description: PDF report generated, public download URL returned }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
// PDF export — President and Treasurer only
router.post(
  '/:groupId/reports/export',
  auth,
  tenant,
  requireRole('president', 'treasurer'),
  async (req, res) => {
    try {
      const url = await reportService.generatePDFReport(req.params.groupId);
      res.json({ url });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
    }
  }
);

/**
 * @swagger
 * /groups/{groupId}/reports/my-history/pdf:
 *   get:
 *     summary: Download personal statement report PDF for authenticated member
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: PDF personal statement returned }
 *       401: { description: Not authenticated }
 *       500: { description: Server error }
 */
router.get(
  '/:groupId/reports/my-history/pdf',
  auth,
  tenant,
  async (req, res, next) => {
    try {
      const buffer = await reportService.generatePersonalStatementPDF(req.params.groupId, req.user.sub);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=personal-statement-${req.user.sub}.pdf`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
