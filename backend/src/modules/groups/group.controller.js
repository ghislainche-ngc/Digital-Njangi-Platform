'use strict';

const groupService = require('./group.service');
const { AuditService, AuditEvents } = require('../../services/audit/AuditService');
const { supabase } = require('../../config/supabase');
const { createGroupSchema, updateGroupSchema, updateGatewaySchema, updatePayoutGatewaySchema } = require('./group.validation');

const audit = new AuditService(supabase);

const createGroup = async (req, res, next) => {
  try {
    const { error, value } = createGroupSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const group = await groupService.createGroup(req.user.sub, value);
    return res.status(201).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const listMyGroups = async (req, res, next) => {
  try {
    const groups = await groupService.listMyGroups(req.user.sub);
    return res.status(200).json({ data: groups });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const getGroup = async (req, res, next) => {
  try {
    const group = await groupService.getGroup(req.params.groupId);
    return res.status(200).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { error, value } = updateGroupSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const group = await groupService.updateSettings(req.params.groupId, value);
    return res.status(200).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const updateGateway = async (req, res, next) => {
  try {
    const { error, value } = updateGatewaySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const { data: before } = await supabase
      .from('njangi_groups')
      .select('preferred_gateway')
      .eq('id', req.params.groupId)
      .maybeSingle();
    const oldGateway = before ? before.preferred_gateway : null;

    const group = await groupService.updateGateway(req.params.groupId, value.gateway);

    await audit.log(req.params.groupId, req.user.sub, AuditEvents.GATEWAY_CHANGED, {
      from: oldGateway, to: value.gateway,
    });
    return res.status(200).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

const updatePayoutGateway = async (req, res, next) => {
  try {
    const { error, value } = updatePayoutGatewaySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const { data: before } = await supabase
      .from('njangi_groups')
      .select('preferred_payout_gateway')
      .eq('id', req.params.groupId)
      .maybeSingle();
    const oldPayoutGateway = before ? before.preferred_payout_gateway : null;

    const group = await groupService.updatePayoutGateway(req.params.groupId, value.payout_gateway);

    await audit.log(req.params.groupId, req.user.sub, AuditEvents.PAYOUT_GATEWAY_CHANGED, {
      from: oldPayoutGateway, to: value.payout_gateway,
    });
    return res.status(200).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

module.exports = { createGroup, listMyGroups, getGroup, updateSettings, updateGateway, updatePayoutGateway };
