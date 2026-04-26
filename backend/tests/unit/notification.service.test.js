'use strict';

const NotificationService = require('../../src/services/notification/NotificationService');
const TelegramNotificationService = require('../../src/services/notification/TelegramNotificationService');
const { templates } = require('../../src/services/notification/index');

/**
 * Unit tests for NotificationService OOP hierarchy and templates.
 *
 * @task Dev C (implements) / Dev D (writes tests)
 */

describe('NotificationService (abstract class)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new NotificationService()).toThrow('abstract');
  });
});

describe('TelegramNotificationService', () => {
  it('extends NotificationService', () => {
    const svc = new TelegramNotificationService();
    expect(svc).toBeInstanceOf(NotificationService);
  });

  it('sendBulk resolves even if one send fails', async () => {
    const svc = new TelegramNotificationService();
    jest.spyOn(svc, 'send').mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('send failed'));

    const results = await svc.sendBulk(['chat_1', 'chat_2'], 'hello');
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
  });
});

describe('Message templates', () => {
  it('paymentReminder generates bilingual text', () => {
    const msg = templates.paymentReminder('Alice', 10000, '01 May');
    expect(msg).toContain('Alice');
    expect(msg).toContain('10000 FCFA');
    expect(msg).toContain('01 May');
    expect(msg).toMatch(/rappel/i);
    expect(msg).toMatch(/reminder/i);
  });

  it('fraudAlert contains treasurer name', () => {
    const msg = templates.fraudAlert('Bob Treasurer');
    expect(msg).toContain('Bob Treasurer');
    expect(msg).toMatch(/alerte|alert/i);
  });
});
