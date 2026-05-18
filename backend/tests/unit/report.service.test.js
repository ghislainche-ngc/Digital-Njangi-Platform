'use strict';

const ReportService = require('../../src/modules/reports/report.service');

describe('ReportService', () => {
  let db;
  let pdfService;
  let service;

  beforeEach(() => {
    db = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getClient: jest.fn(),
    };
    pdfService = {
      generateLedgerReport: jest.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
    };
    service = new ReportService(db, pdfService);
  });

  describe('getSummary', () => {
    it('computes totalContributed, totalPaidOut and balance from findAll results', async () => {
      db.findAll.mockImplementation(async (table, filters) => {
        if (table === 'contributions') {
          return [{ amount: '5000' }, { amount: 2500 }, { amount: '1500' }];
        }
        if (table === 'payouts') {
          return [{ amount: '6000' }, { amount: 1000 }];
        }
        if (table === 'cycles') {
          return [{ id: 'c1' }, { id: 'c2' }];
        }
        return [];
      });

      const summary = await service.getSummary('group-1');

      expect(summary.totalContributed).toBe(9000);
      expect(summary.totalPaidOut).toBe(7000);
      expect(summary.balance).toBe(2000);
      expect(summary.cycleCount).toBe(2);
    });
  });

  describe('getLedger', () => {
    it('returns a group object and cycles array with mapped contributions', async () => {
      db.findById.mockResolvedValue({ id: 'group-1', name: 'Family Njangi' });

      db.findAll.mockImplementation(async (table) => {
        if (table === 'cycles') {
          return [{ id: 'cycle-1', cycle_number: 1, status: 'active' }];
        }
        if (table === 'contributions') {
          return [
            {
              amount: '5000',
              status: 'confirmed',
              created_at: '2026-05-01',
              users: { full_name: 'Jane Doe' },
            },
          ];
        }
        return [];
      });

      db.findOne.mockResolvedValue(null);

      const ledger = await service.getLedger('group-1');

      expect(ledger.group).toEqual({ name: 'Family Njangi', currentBalance: 5000 });
      expect(Array.isArray(ledger.cycles)).toBe(true);
      expect(ledger.cycles).toHaveLength(1);

      const cycle = ledger.cycles[0];
      expect(cycle.cycleNumber).toBe(1);
      expect(cycle.status).toBe('active');
      expect(cycle.payout).toBeNull();
      expect(cycle.contributions).toEqual([
        {
          memberName: 'Jane Doe',
          amount: 5000,
          status: 'confirmed',
          date: '2026-05-01',
        },
      ]);
    });
  });

  describe('generatePDFReport', () => {
    it('calls pdfService.generateLedgerReport and returns the public URL', async () => {
      db.findById.mockResolvedValue({ id: 'group-1', name: 'Family Njangi' });
      db.findAll.mockResolvedValue([]);
      db.findOne.mockResolvedValue(null);

      const upload = jest
        .fn()
        .mockResolvedValue({ data: { path: 'p' }, error: null });
      const getPublicUrl = jest
        .fn()
        .mockReturnValue({ data: { publicUrl: 'https://example.com/p.pdf' } });

      db.getClient.mockReturnValue({
        storage: {
          from: jest.fn().mockReturnValue({ upload, getPublicUrl }),
        },
      });

      const url = await service.generatePDFReport('group-1');

      expect(pdfService.generateLedgerReport).toHaveBeenCalledTimes(1);
      const [groupData, ledgerData] = pdfService.generateLedgerReport.mock.calls[0];
      expect(groupData).toEqual({ name: 'Family Njangi' });
      expect(ledgerData).toHaveProperty('cycles');
      expect(ledgerData).toHaveProperty('balance');
      expect(url).toBe('https://example.com/p.pdf');
    });
  });
});
