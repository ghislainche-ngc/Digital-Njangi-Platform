'use strict';

const { supabase } = require('../../config/supabase');

const getPublicStats = async (req, res, next) => {
  try {
    // 1. Count active groups
    const { count: totalGroups, error: groupError } = await supabase
      .from('njangi_groups')
      .select('*', { count: 'exact', head: true });

    if (groupError) throw groupError;

    // 2. Count registered users
    const { count: totalUsers, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (userError) throw userError;

    // 3. Sum transaction volume (successful deposits/debits)
    const { data: txs, error: txError } = await supabase
      .from('payment_transactions')
      .select('amount')
      .eq('status', 'success')
      .eq('direction', 'debit');

    if (txError) throw txError;
    const totalVolume = (txs || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    // 4. Fetch 3 most recent transactions (with obfuscated user names)
    const { data: recentTxs, error: recentError } = await supabase
      .from('payment_transactions')
      .select('amount, gateway, status, direction, reference_type, reference_id, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentError) throw recentError;

    const formattedTxs = [];
    if (recentTxs && recentTxs.length > 0) {
      // Resolve user details
      const contribIds = recentTxs.filter(t => t.reference_type === 'contribution').map(t => t.reference_id);
      const payoutIds = recentTxs.filter(t => t.reference_type === 'payout').map(t => t.reference_id);

      let contributions = [];
      if (contribIds.length > 0) {
        const { data } = await supabase
          .from('contributions')
          .select('id, user_id')
          .in('id', contribIds);
        contributions = data || [];
      }

      let payouts = [];
      if (payoutIds.length > 0) {
        const { data } = await supabase
          .from('payouts')
          .select('id, recipient_id')
          .in('id', payoutIds);
        payouts = data || [];
      }

      const userIds = new Set();
      contributions.forEach(c => { if (c.user_id) userIds.add(c.user_id); });
      payouts.forEach(p => { if (p.recipient_id) userIds.add(p.recipient_id); });

      let users = [];
      if (userIds.size > 0) {
        const { data } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', Array.from(userIds));
        users = data || [];
      }

      const userMap = {};
      users.forEach(u => {
        // Obfuscate name: e.g. "Jean-Pierre Mbarga" -> "Jean-Pierre M."
        const parts = (u.full_name || '').split(' ');
        let obfName = 'Member';
        if (parts.length > 1) {
          obfName = `${parts[0]} ${parts[parts.length - 1][0]}.`;
        } else if (parts.length === 1 && parts[0]) {
          obfName = parts[0];
        }
        userMap[u.id] = obfName;
      });

      const refUserLookup = {};
      contributions.forEach(c => {
        refUserLookup[c.id] = userMap[c.user_id] || 'Member';
      });
      payouts.forEach(p => {
        refUserLookup[p.id] = userMap[p.recipient_id] || 'Member';
      });

      recentTxs.forEach(tx => {
        const userName = refUserLookup[tx.reference_id] || 'Member';
        formattedTxs.push({
          userName,
          amount: tx.amount,
          gateway: tx.gateway,
          status: tx.status,
          direction: tx.direction,
          created_at: tx.created_at,
        });
      });
    }

    return res.status(200).json({
      totalGroups: totalGroups || 0,
      totalUsers: totalUsers || 0,
      totalVolume,
      recentTransactions: formattedTxs,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublicStats,
};
