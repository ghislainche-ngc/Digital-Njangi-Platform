'use strict';

const { supabase } = require('../config/supabase');

/**
 * Resolves the group from the URL :groupId param.
 * Verifies the authenticated user is an active member of that group.
 * Attaches the group record to req.group and membership to req.membership.
 *
 * Must be applied AFTER authMiddleware.
 *
 * @task Dev A — Task A-04
 */
const tenantMiddleware = async (req, res, next) => {
  const { groupId } = req.params;

  if (!groupId) {
    return next(); // route doesn't have a :groupId param
  }

  try {
    // Verify membership
    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .select('*, njangi_groups(*)')
      .eq('user_id', req.user.sub)
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single();

    if (memError || !membership) {
      return res.status(403).json({
        error: 'You are not a member of this group.',
        code: 'NOT_A_MEMBER',
      });
    }

    req.group = membership.njangi_groups;
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = tenantMiddleware;
