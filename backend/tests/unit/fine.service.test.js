'use strict';

const FineService = require('../../src/modules/fines/fine.service');
const { AuditEvents } = require('../../src/services/audit/AuditService');

describe('FineService', () => {
  let db;
  let auditService;
  let service;

  beforeEach(() => {
    db = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    auditService = { log: jest.fn() };
    service = new FineService(db, auditService);
  });

  describe('recordFine', () => {
    it('inserts a fine and returns it; logs FINE_APPLIED', async () => {
      const created = { id: 'fine-1', group_id: 'g1', user_id: 'm1', amount: 500, status: 'unpaid' };
      db.create.mockResolvedValue([created]);

      const result = await service.recordFine('g1', 'm1', 500, 'Late payment', 'treasurer-1');

      expect(result).toEqual(created);
      expect(db.create).toHaveBeenCalledWith('fines', {
        group_id: 'g1',
        user_id: 'm1',
        amount: 500,
        reason: 'Late payment',
        applied_by: 'treasurer-1',
        status: 'unpaid',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'g1',
        'treasurer-1',
        AuditEvents.FINE_APPLIED,
        { memberId: 'm1', amount: 500, reason: 'Late payment' }
      );
    });

    it('throws statusCode 400 when amount is 0 or negative', async () => {
      await expect(service.recordFine('g1', 'm1', 0, 'Late', 'tr-1')).rejects.toMatchObject({
        statusCode: 400,
      });
      await expect(service.recordFine('g1', 'm1', -50, 'Late', 'tr-1')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(db.create).not.toHaveBeenCalled();
    });

    it('throws statusCode 400 when reason is missing', async () => {
      await expect(service.recordFine('g1', 'm1', 500, '', 'tr-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('waiveFine', () => {
    it('throws statusCode 400 when called without a reason', async () => {
      await expect(service.waiveFine('fine-1', 'pres-1', '')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(db.findById).not.toHaveBeenCalled();
    });

    it('throws statusCode 404 when the fine does not exist', async () => {
      db.findById.mockResolvedValue(null);
      await expect(
        service.waiveFine('missing', 'pres-1', 'Hardship')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('logs FINE_WAIVED with waivedBy and reason in the payload', async () => {
      db.findById.mockResolvedValue({ id: 'fine-1', group_id: 'g1' });
      db.update.mockResolvedValue([{ id: 'fine-1', status: 'waived' }]);

      await service.waiveFine('fine-1', 'pres-1', 'Member hardship');

      expect(auditService.log).toHaveBeenCalledWith(
        'g1',
        'pres-1',
        AuditEvents.FINE_WAIVED,
        expect.objectContaining({ waivedBy: 'pres-1', reason: 'Member hardship' })
      );
    });
  });

  describe('markPaid', () => {
    it('throws statusCode 404 when the fine does not exist', async () => {
      db.findById.mockResolvedValue(null);
      await expect(service.markPaid('missing', 'tr-1', 'cash')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('updates the fine to paid and logs FINE_PAID', async () => {
      db.findById.mockResolvedValue({ id: 'fine-1', group_id: 'g1' });
      db.update.mockResolvedValue([{ id: 'fine-1', status: 'paid' }]);

      const result = await service.markPaid('fine-1', 'tr-1', 'mobile_money');

      expect(result).toEqual({ id: 'fine-1', status: 'paid' });
      expect(auditService.log).toHaveBeenCalledWith(
        'g1',
        'tr-1',
        AuditEvents.FINE_PAID,
        { fineId: 'fine-1', paymentMethod: 'mobile_money' }
      );
    });
  });

  describe('hasUnpaidFines', () => {
    it('returns true when findAll returns a non-empty array', async () => {
      db.findAll.mockResolvedValue([{ id: 'fine-1', status: 'unpaid' }]);
      await expect(service.hasUnpaidFines('g1', 'm1')).resolves.toBe(true);
    });

    it('returns false when findAll returns an empty array', async () => {
      db.findAll.mockResolvedValue([]);
      await expect(service.hasUnpaidFines('g1', 'm1')).resolves.toBe(false);
    });
  });
});
