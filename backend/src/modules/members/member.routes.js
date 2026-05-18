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

/**
 * @swagger
 * /groups/{groupId}/invitations:
 *   post:
 *     summary: Invite a user to join the group (President or Secretary)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+237677000002" }
 *     responses:
 *       201: { description: Invitation created and sent }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: User already invited or a member }
 *       500: { description: Server error }
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

/**
 * @swagger
 * /groups/invitations/{token}:
 *   get:
 *     summary: Look up an invitation by token (public)
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invitation details returned }
 *       404: { description: Invitation not found }
 *       500: { description: Server error }
 */
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

/**
 * @swagger
 * /groups/invitations/{token}/accept:
 *   post:
 *     summary: Accept a group invitation
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Invitation accepted, user added to group }
 *       400: { description: Invalid or expired token }
 *       401: { description: Not authenticated }
 *       409: { description: Already a member of this group }
 *       500: { description: Server error }
 */
router.post('/invitations/:token/accept', auth, async (req, res, next) => {
  try {
    const membership = await memberService.acceptInvite(req.params.token, req.user.sub);
    return res.status(201).json(membership);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
});

/**
 * @swagger
 * /groups/{groupId}/members:
 *   get:
 *     summary: List all members of a group
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of group members returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
router.get('/:groupId/members', auth, tenant, async (req, res, next) => {
  try {
    const members = await memberService.listMembers(req.params.groupId);
    return res.status(200).json(members);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /groups/{groupId}/members/{userId}/role:
 *   patch:
 *     summary: Change a member's role (President only)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [member, secretary, treasurer, president], example: treasurer }
 *     responses:
 *       200: { description: Member role updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
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

/**
 * @swagger
 * /groups/{groupId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the group (President only)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Member removed }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
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
