'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { createGroup, listMyGroups, getGroup, updateSettings, updateGateway, updatePayoutGateway } = require('./group.controller');

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Njangi group creation and management
 */

/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Create a new Njangi group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, contribution_amount, frequency]
 *             properties:
 *               name:                { type: string, example: Buea Family Njangi }
 *               contribution_amount: { type: number, example: 10000 }
 *               frequency:           { type: string, enum: [weekly, monthly], example: monthly }
 *               payout_mode:         { type: string, enum: [rotation, president_decides, lottery], example: rotation }
 *               currency:            { type: string, example: XAF }
 *     responses:
 *       201: { description: Group created }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       409: { description: Group with this name already exists }
 *       500: { description: Server error }
 */
// POST /groups — create a new group
router.post('/', auth, createGroup);

// GET /groups/mine — list groups the current user belongs to
router.get('/mine', auth, listMyGroups);

/**
 * @swagger
 * /groups/{groupId}:
 *   get:
 *     summary: Get group details
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Group details returned }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 *       500: { description: Server error }
 */
// GET /groups/:groupId — get group details
router.get('/:groupId', auth, tenant, getGroup);

/**
 * @swagger
 * /groups/{groupId}:
 *   patch:
 *     summary: Update group settings (President only)
 *     tags: [Groups]
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
 *             properties:
 *               name:                { type: string, example: Buea Family Njangi }
 *               contribution_amount: { type: number, example: 12000 }
 *               frequency:           { type: string, enum: [weekly, monthly], example: monthly }
 *               payout_mode:         { type: string, enum: [rotation, president_decides, lottery], example: rotation }
 *     responses:
 *       200: { description: Settings updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Insufficient permissions }
 *       500: { description: Server error }
 */
// PATCH /groups/:groupId — update settings (President only)
router.patch('/:groupId', auth, tenant, requireRole('president'), updateSettings);

/**
 * @swagger
 * /groups/{groupId}/gateway:
 *   patch:
 *     summary: Change the group's preferred collection gateway (President only)
 *     tags: [Groups]
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
 *             required: [gateway]
 *             properties:
 *               gateway:
 *                 type: string
 *                 enum: [mtn_momo, orange_money, campay]
 *                 example: campay
 *     responses:
 *       200: { description: Gateway updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Not a group president }
 *       404: { description: Group not found }
 *       500: { description: Server error }
 */
router.patch('/:groupId/gateway', auth, tenant, requireRole('president'), updateGateway);

/**
 * @swagger
 * /groups/{groupId}/payout-gateway:
 *   patch:
 *     summary: Change the group's preferred payout gateway (President only)
 *     description: |
 *       Setting payout_gateway to null reverts the group to phone-prefix
 *       routing (the default). Setting it to 'campay' routes payouts via
 *       Campay's /withdraw/ endpoint.
 *     tags: [Groups]
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
 *             required: [payout_gateway]
 *             properties:
 *               payout_gateway:
 *                 type: [string, "null"]
 *                 enum: [mtn_momo, orange_money, campay, null]
 *                 example: campay
 *     responses:
 *       200: { description: Payout gateway updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Not a group president }
 *       404: { description: Group not found }
 *       500: { description: Server error }
 */
router.patch('/:groupId/payout-gateway', auth, tenant, requireRole('president'), updatePayoutGateway);

module.exports = router;
