'use strict';

const pdfService = require('../../src/services/pdf/PDFService');

describe('PDFService', () => {
  describe('generateLedgerReport', () => {
    it('returns a non-empty Buffer for a minimal valid argument set', async () => {
      const groupData = { name: 'Test Group' };
      const ledgerData = {
        totalContributed: 0,
        totalPaidOut: 0,
        balance: 0,
        cycles: [],
      };

      const buffer = await pdfService.generateLedgerReport(groupData, ledgerData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('returns a non-empty Buffer when a cycle has a contribution and a payout', async () => {
      const groupData = { name: 'Mboa Savings Circle' };
      const ledgerData = {
        totalContributed: 150000,
        totalPaidOut: 100000,
        balance: 50000,
        cycles: [
          {
            cycleNumber: 1,
            status: 'completed',
            contributions: [
              {
                memberName: 'Ngozi Tabi',
                amount: 25000,
                status: 'paid',
                date: '2026-03-01T10:00:00.000Z',
              },
            ],
            payout: {
              recipientName: 'Ngozi Tabi',
              amount: 100000,
            },
          },
        ],
      };

      const buffer = await pdfService.generateLedgerReport(groupData, ledgerData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('returns a Buffer that starts with the PDF magic bytes', async () => {
      const buffer = await pdfService.generateLedgerReport(
        { name: 'Magic Bytes Group' },
        { totalContributed: 0, totalPaidOut: 0, balance: 0, cycles: [] }
      );

      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generateReceiptPDF', () => {
    it('returns a non-empty Buffer for a full contribution object', async () => {
      const contribution = {
        memberName: 'Achille Fomum',
        groupName: 'Mboa Savings Circle',
        cycleNumber: 3,
        amount: 25000,
        method: 'MTN Mobile Money',
        date: new Date('2026-04-15T08:30:00.000Z'),
      };

      const buffer = await pdfService.generateReceiptPDF(contribution);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('returns a Buffer that starts with the PDF magic bytes', async () => {
      const contribution = {
        memberName: 'Achille Fomum',
        groupName: 'Mboa Savings Circle',
        cycleNumber: 3,
        amount: 25000,
        method: 'Orange Money',
        date: '2026-04-15T08:30:00.000Z',
      };

      const buffer = await pdfService.generateReceiptPDF(contribution);

      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });
});
