'use strict';

/**
 * ReportService — ledger, financial summary, personal history, PDF export.
 *
 * @task Dev C — Task C-05
 */
class ReportService {
  constructor(pdfService) {
    this.pdfService = pdfService;
  }

  /**
   * Full immutable ledger — every contribution and payout since group creation.
   * Read-only. No member can edit or delete entries.
   */
  async getLedger(groupId) {
    // TODO (Dev C): join cycles + contributions + payouts
    throw new Error('Not implemented');
  }

  /**
   * Financial summary for the group (total contributed, total paid out, balance).
   */
  async getSummary(groupId) {
    // TODO (Dev C)
    throw new Error('Not implemented');
  }

  /**
   * Personal contribution and payout history for a single user.
   */
  async getPersonalHistory(groupId, userId) {
    // TODO (Dev C)
    throw new Error('Not implemented');
  }

  /**
   * Generate full PDF report. Returns Buffer.
   * Uploads to Supabase Storage and returns the public download URL.
   */
  async generatePDFReport(groupId) {
    // TODO (Dev C):
    // 1. getLedger + getSummary
    // 2. pdfService.generateLedgerReport(groupData, ledgerData) → Buffer
    // 3. Upload to Supabase Storage bucket 'receipts'
    // 4. Return public URL
    throw new Error('Not implemented');
  }
}

module.exports = ReportService;
