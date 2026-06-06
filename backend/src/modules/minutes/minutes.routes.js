'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const minutesService = require('./minutes.service');

/**
 * GET /groups/:groupId/minutes
 * Retrieve all meeting minutes (accessible by any group member).
 */
router.get('/:groupId/minutes', auth, tenant, async (req, res, next) => {
  try {
    const list = await minutesService.listMinutes(req.params.groupId);
    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /groups/:groupId/minutes
 * Create new meeting minutes (President/Secretary only).
 */
router.post('/:groupId/minutes', auth, tenant, requireRole('president', 'secretary'), async (req, res, next) => {
  try {
    const { title, date, attendees, pages, status, description } = req.body;
    if (!title || !date || !description) {
      return res.status(400).json({ error: 'Title, date, and description are required.' });
    }

    const minutes = await minutesService.createMinutes(
      req.params.groupId,
      { title, date, attendees, pages, status, description },
      req.user.sub
    );
    return res.status(201).json(minutes);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

/**
 * PATCH /groups/:groupId/minutes/:id/status
 * Update status of meeting minutes (President/Secretary only).
 */
router.patch('/:groupId/minutes/:id/status', auth, tenant, requireRole('president', 'secretary'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: 'Invalid or missing status.' });
    }

    const minutes = await minutesService.updateMinutesStatus(req.params.groupId, req.params.id, status);
    return res.status(200).json(minutes);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

/**
 * DELETE /groups/:groupId/minutes/:id
 * Delete meeting minutes (President/Secretary only).
 */
router.delete('/:groupId/minutes/:id', auth, tenant, requireRole('president', 'secretary'), async (req, res, next) => {
  try {
    await minutesService.deleteMinutes(req.params.groupId, req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

module.exports = router;
