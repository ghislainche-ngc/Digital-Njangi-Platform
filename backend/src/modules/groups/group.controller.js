'use strict';

const groupService = require('./group.service');

const createGroup = async (req, res, next) => {
  try {
    const group = await groupService.createGroup(req.user.sub, req.body);
    return res.status(201).json(group);
  } catch (err) { next(err); }
};

const getGroup = async (req, res, next) => {
  try {
    const group = await groupService.getGroup(req.params.groupId);
    return res.status(200).json(group);
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const group = await groupService.updateSettings(req.params.groupId, req.body);
    return res.status(200).json(group);
  } catch (err) { next(err); }
};

module.exports = { createGroup, getGroup, updateSettings };
