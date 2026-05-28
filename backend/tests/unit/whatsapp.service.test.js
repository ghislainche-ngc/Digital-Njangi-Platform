'use strict';

const WhatsAppNotificationService = require('../../src/services/notification/WhatsAppNotificationService');

describe('WhatsAppNotificationService Unit Tests', () => {
  let service;

  beforeAll(() => {
    service = new WhatsAppNotificationService();
  });

  describe('Phone number formatting JID helper', () => {
    test('should format E.164 phone numbers with plus sign and spaces', () => {
      const jid = service._formatJid('+237 677 000 001');
      expect(jid).toBe('237677000001@c.us');
    });

    test('should format local Cameroonian 9-digit numbers missing country code', () => {
      const jid = service._formatJid('677000002');
      expect(jid).toBe('237677000002@c.us');
    });

    test('should format raw numeric strings', () => {
      const jid = service._formatJid('237699000003');
      expect(jid).toBe('237699000003@c.us');
    });

    test('should return null for invalid input', () => {
      const jid = service._formatJid(null);
      expect(jid).toBeNull();
    });
  });

  describe('Sending when client disconnected', () => {
    test('should return success: false when client is not connected', async () => {
      const res = await service.send('+237677000001', 'Test message');
      expect(res.success).toBe(false);
      expect(res.error).toContain('WhatsApp client is not connected');
    });
  });
});
