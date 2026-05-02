'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const memberService = require('./member.service');

/**
 * @swagger
 * tags:
 *   name: Members
 *   description: Group membership — invite, join, roles, removal
 */

router.post('/:groupId/invitations', auth, tenant, requireRole('president', 'secretary'), async (req, res, next) => {
  try {
    const invitation = await memberService.inviteMember(req.params.groupId, req.body.phone, req.user.sub);
    return res.status(201).json(invitation);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

router.get('/invitations/:token', async (req, res, next) => {
  try {
    const { supabase } = require('../../config/supabase');
    const { data, error } = await supabase
      .from('invitations')
      .select('*, njangi_groups(name)')
      .eq('token', req.params.token)
      .eq('status', 'pending')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Invitation not found.', code: 'NOT_FOUND' });
    return res.status(200).json(data);
  } catch (err) { next(err); }
});

router.post('/invitations/:token/accept', auth, async (req, res, next) => {
  try {
    const membership = await memberService.acceptInvite(req.params.token, req.user.sub);
    return res.status(201).json(membership);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

router.get('/:groupId/members', auth, tenant, async (req, res, next) => {
  try {
    const members = await memberService.listMembers(req.params.groupId);
    return res.status(200).json(members);
  } catch (err) { next(err); }
});

router.patch('/:groupId/members/:userId/role', auth, tenant, requireRole('president'), async (req, res, next) => {
  try {
    const membership = await memberService.assignRole(
      req.params.groupId, req.params.userId, req.body.role, req.user.sub
    );
    return res.status(200).json(membership);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

router.delete('/:groupId/members/:userId', auth, tenant, requireRole('president'), async (req, res, next) => {
  try {
    const membership = await memberService.removeMember(
      req.params.groupId, req.params.userId, req.user.sub
    );
    return res.status(200).json(membership);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

module.exports = router;
