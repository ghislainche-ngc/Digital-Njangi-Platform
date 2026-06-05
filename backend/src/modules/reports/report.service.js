'use strict';

/**
 * ReportService — ledger, financial summary, personal history, PDF export.
 *
 * Dependency-injected: receives `db` (DBConnect instance) and `pdfService`.
 * Does NOT import config/supabase — that import throws without env vars.
 *
 * @task Dev C — Task C-05
 */
class ReportService {
  /**
   * @param {object} db - DBConnect instance (findById, findAll, findOne, getClient, ...)
   * @param {object} pdfService - PDFService singleton (generateLedgerReport, ...)
   */
  constructor(db, pdfService) {
    this.db = db;
    this.pdfService = pdfService;
  }

  /**
   * Full immutable ledger — every contribution and payout since group creation.
   * Read-only. No member can edit or delete entries.
   */
  async getLedger(groupId) {
    const group = await this.db.findById('njangi_groups', groupId);
    if (!group) {
      const err = new Error('Group not found');
      err.statusCode = 404;
      throw err;
    }

    const cycles = await this.db.findAll(
      'cycles',
      { group_id: groupId },
      { orderBy: 'cycle_number', ascending: true }
    );

    let confirmedContributionTotal = 0;
    let completedPayoutTotal = 0;
    const cycleEntries = [];

    for (const cycle of cycles || []) {
      const contributionRows = await this.db.findAll(
        'contributions',
        { cycle_id: cycle.id },
        { columns: 'id,amount,status,created_at,users!contributions_user_id_fkey(full_name)' }
      );

      const contributions = (contributionRows || []).map((row) => {
        const amount = Number(row.amount) || 0;
        if (row.status === 'confirmed') {
          confirmedContributionTotal += amount;
        }
        return {
          id: row.id,
          memberName: (row.users && row.users.full_name) || '—',
          amount,
          status: row.status,
          date: row.created_at,
        };
      });

      const payoutRow = await this.db.findOne(
        'payouts',
        { cycle_id: cycle.id },
        'id,amount,status,executed_at,users!payouts_recipient_id_fkey(full_name)'
      );

      let payout = null;
      if (payoutRow) {
        const payoutAmount = Number(payoutRow.amount) || 0;
        if (payoutRow.status === 'completed') {
          completedPayoutTotal += payoutAmount;
        }
        payout = {
          id: payoutRow.id,
          recipientName: (payoutRow.users && payoutRow.users.full_name) || '—',
          amount: payoutAmount,
          date: payoutRow.executed_at,
        };
      }

      cycleEntries.push({
        cycleNumber: cycle.cycle_number,
        status: cycle.status,
        contributions,
        payout,
      });
    }

    const currentBalance = confirmedContributionTotal - completedPayoutTotal;

    return {
      group: { name: group.name, currentBalance },
      cycles: cycleEntries,
    };
  }

  /**
   * Financial summary for the group (total contributed, total paid out, balance).
   */
  async getSummary(groupId) {
    const confirmedContributions = await this.db.findAll('contributions', {
      group_id: groupId,
      status: 'confirmed',
    });
    const completedPayouts = await this.db.findAll('payouts', {
      group_id: groupId,
      status: 'completed',
    });
    const cycles = await this.db.findAll('cycles', { group_id: groupId });

    const totalContributed = (confirmedContributions || []).reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0
    );
    const totalPaidOut = (completedPayouts || []).reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0
    );

    return {
      totalContributed,
      totalPaidOut,
      balance: totalContributed - totalPaidOut,
      cycleCount: (cycles || []).length,
    };
  }

  /**
   * Personal contribution and payout history for a single user.
   */
  async getPersonalHistory(groupId, userId) {
    const contributions = await this.db.findAll('contributions', {
      group_id: groupId,
      user_id: userId,
    });
    const payouts = await this.db.findAll('payouts', {
      group_id: groupId,
      recipient_id: userId,
    });

    return {
      contributions: contributions || [],
      payouts: payouts || [],
    };
  }

  /**
   * Generate full PDF report, upload to Supabase Storage, return public URL.
   */
  async generatePDFReport(groupId) {
    const ledger = await this.getLedger(groupId);
    const summary = await this.getSummary(groupId);

    const ledgerData = {
      totalContributed: summary.totalContributed,
      totalPaidOut: summary.totalPaidOut,
      balance: summary.balance,
      cycles: ledger.cycles,
    };
    const groupData = { name: ledger.group.name };

    const buffer = await this.pdfService.generateLedgerReport(groupData, ledgerData);

    const client = this.db.getClient();
    const path = `${groupId}/reports/${Date.now()}.pdf`;
    const { data, error } = await client.storage
      .from('receipts')
      .upload(path, buffer, { contentType: 'application/pdf', upsert: true });
    if (error) throw error;

    const { data: urlData } = client.storage.from('receipts').getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  /**
   * Generate a PDF personal statement for a member.
   */
  async generatePersonalStatementPDF(groupId, userId) {
    const group = await this.db.findById('njangi_groups', groupId);
    if (!group) {
      const err = new Error('Group not found');
      err.statusCode = 404;
      throw err;
    }

    const membership = await this.db.findOne('memberships', {
      group_id: groupId,
      user_id: userId
    }, 'id,status,rotation_position,users!memberships_user_id_fkey(full_name, email)');

    if (!membership) {
      const err = new Error('Membership not found');
      err.statusCode = 404;
      throw err;
    }

    const history = await this.getPersonalHistory(groupId, userId);

    const contributionsWithCycles = [];
    for (const c of (history.contributions || [])) {
      const cycle = await this.db.findById('cycles', c.cycle_id);
      contributionsWithCycles.push({
        ...c,
        cycles: { cycle_number: cycle ? cycle.cycle_number : 1 }
      });
    }

    const payoutsWithCycles = [];
    for (const p of (history.payouts || [])) {
      const cycle = await this.db.findById('cycles', p.cycle_id);
      payoutsWithCycles.push({
        ...p,
        cycles: { cycle_number: cycle ? cycle.cycle_number : 1 }
      });
    }

    const confirmedContributions = contributionsWithCycles.filter(c => c.status === 'confirmed');
    const totalPaid = confirmedContributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const successRate = contributionsWithCycles.length > 0
      ? Math.round((confirmedContributions.length / contributionsWithCycles.length) * 100)
      : 100;

    const memberData = {
      memberName: membership.users?.full_name || membership.users?.email || 'Member',
      groupName: group.name,
      successRate,
      totalPaid
    };

    const buffer = await this.pdfService.generatePersonalStatementPDF(memberData, {
      contributions: contributionsWithCycles,
      payouts: payoutsWithCycles
    });

    return buffer;
  }
}

module.exports = ReportService;
