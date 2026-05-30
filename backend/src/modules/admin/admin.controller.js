'use strict';

const adminService = require('./admin.service');

const getPlatformStats = async (req, res, next) => {
  try {
    const stats = await adminService.getPlatformStats();
    return res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
};

const getPlatformGroups = async (req, res, next) => {
  try {
    const groups = await adminService.getPlatformGroups();
    return res.status(200).json({ data: groups });
  } catch (err) {
    next(err);
  }
};

const updateGroupSubscription = async (req, res, next) => {
  try {
    const { subscription_tier, subscription_status, subscription_expires_at } = req.body;
    const group = await adminService.updateGroupSubscription(req.params.groupId, {
      subscription_tier,
      subscription_status,
      subscription_expires_at,
    });
    return res.status(200).json(group);
  } catch (err) {
    next(err);
  }
};

const updateGroupStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const group = await adminService.updateGroupStatus(req.params.groupId, status);
    return res.status(200).json(group);
  } catch (err) {
    next(err);
  }
};

const getGlobalTransactions = async (req, res, next) => {
  try {
    const txs = await adminService.getGlobalTransactions();
    return res.status(200).json({ data: txs });
  } catch (err) {
    next(err);
  }
};

const getPlatformUsers = async (req, res, next) => {
  try {
    const users = await adminService.getPlatformUsers();
    return res.status(200).json({ data: users });
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { is_admin } = req.body;
    const user = await adminService.updateUserRole(req.params.userId, { is_admin }, req.user.sub);
    return res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await adminService.deleteUser(req.params.userId, req.user.sub);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPlatformStats,
  getPlatformGroups,
  updateGroupSubscription,
  updateGroupStatus,
  getGlobalTransactions,
  getPlatformUsers,
  updateUserRole,
  deleteUser,
};
