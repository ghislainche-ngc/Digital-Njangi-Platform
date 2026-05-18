'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');

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
 *               email: { type: string, example: bob@njangi.cm }
 *               role:  { type: string, enum: [member, secretary, treasurer], default: member }
 *     responses:
 *       201: { description: Invitation created and sent }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       409: { description: User already invited or a member }
 *       500: { description: Server error }
 */
// POST /groups/:groupId/invitations
router.post('/:groupId/invitations', auth, tenant, requireRole('president', 'secretary'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
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
 *       400: { description: Invalid or expired token }
 *       500: { description: Server error }
 */
// GET /invitations/:token (public — anyone with the link)
router.get('/invitations/:token', (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
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
 *       200: { description: Invitation accepted, user added to group }
 *       400: { description: Invalid or expired token }
 *       401: { description: Not authenticated }
 *       409: { description: Already a member of this group }
 *       500: { description: Server error }
 */
// POST /invitations/:token/accept
router.post('/invitations/:token/accept', auth, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
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
// GET /groups/:groupId/members
router.get('/:groupId/members', auth, tenant, (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
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
// PATCH /groups/:groupId/members/:userId/role
router.patch('/:groupId/members/:userId/role', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
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
// DELETE /groups/:groupId/members/:userId
router.delete('/:groupId/members/:userId', auth, tenant, requireRole('president'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented — Dev A Task A-06' });
});

module.exports = router;
