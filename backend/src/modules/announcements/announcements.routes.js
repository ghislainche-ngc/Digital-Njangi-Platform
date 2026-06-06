'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const announcementsService = require('./announcements.service');

/**
 * GET /groups/:groupId/announcements
 * Retrieve all announcements in the group (accessible by any member).
 */
router.get('/:groupId/announcements', auth, tenant, async (req, res, next) => {
  try {
    const list = await announcementsService.listAnnouncements(req.params.groupId);
    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /groups/:groupId/announcements
 * Publish a new announcement & broadcast (President/Secretary only).
 */
router.post('/:groupId/announcements', auth, tenant, requireRole('president', 'secretary', 'treasurer'), async (req, res, next) => {
  try {
    const { title, body, channels } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
    }
    const channelList = Array.isArray(channels) ? channels : [];
    
    const announcement = await announcementsService.createAnnouncement(
      req.params.groupId,
      title,
      body,
      channelList,
      req.user.sub
    );
    return res.status(201).json(announcement);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

/**
 * DELETE /groups/:groupId/announcements/:id
 * Delete an announcement (President/Secretary only).
 */
router.delete('/:groupId/announcements/:id', auth, tenant, requireRole('president', 'secretary', 'treasurer'), async (req, res, next) => {
  try {
    await announcementsService.deleteAnnouncement(req.params.groupId, req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

module.exports = router;
