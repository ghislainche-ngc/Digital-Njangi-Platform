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

router.get('/:groupId/reports/ledger', auth, tenant, async (req, res) => {
  try {
    const ledger = await reportService.getLedger(req.params.groupId);
    res.json(ledger);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
  }
});

router.get('/:groupId/reports/summary', auth, tenant, async (req, res) => {
  try {
    const summary = await reportService.getSummary(req.params.groupId);
    res.json(summary);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
  }
});

router.get('/:groupId/reports/my-history', auth, tenant, async (req, res) => {
  try {
    const history = await reportService.getPersonalHistory(req.params.groupId, req.user.sub);
    res.json(history);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: 'REPORT_ERROR' });
  }
});

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

module.exports = router;
