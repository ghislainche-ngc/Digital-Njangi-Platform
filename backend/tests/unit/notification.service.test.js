'use strict';

const NotificationService = require('../../src/services/notification/NotificationService');
const TelegramNotificationService = require('../../src/services/notification/TelegramNotificationService');
const SMSNotificationService = require('../../src/services/notification/SMSNotificationService');
const MockNotificationService = require('../../src/services/notification/MockNotificationService');
const {
  templates,
  getNotificationService,
  getMockService,
} = require('../../src/services/notification/index');

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

describe('MockNotificationService', () => {
  it('extends NotificationService', () => {
    expect(new MockNotificationService()).toBeInstanceOf(NotificationService);
  });

  it('records sent messages and returns success without calling any API', async () => {
    const svc = new MockNotificationService();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await svc.send('chat_1', 'hello');

    expect(result.success).toBe(true);
    expect(svc.sent).toEqual([{ recipient: 'chat_1', message: 'hello' }]);
  });

  it('sendBulk delivers to every recipient', async () => {
    const svc = new MockNotificationService();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const results = await svc.sendBulk(['a', 'b', 'c'], 'hi');

    expect(results).toHaveLength(3);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    expect(svc.sent).toHaveLength(3);
  });
});

describe('getNotificationService factory', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDriver = process.env.NOTIFICATION_DRIVER;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDriver === undefined) delete process.env.NOTIFICATION_DRIVER;
    else process.env.NOTIFICATION_DRIVER = originalDriver;
  });

  it('returns the mock service when running under NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    expect(getNotificationService()).toBeInstanceOf(MockNotificationService);
  });

  it('returns the Telegram service for the telegram channel in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NOTIFICATION_DRIVER;
    expect(getNotificationService('telegram')).toBeInstanceOf(TelegramNotificationService);
  });

  it('returns the SMS service for the sms channel in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NOTIFICATION_DRIVER;
    expect(getNotificationService('sms')).toBeInstanceOf(SMSNotificationService);
  });

  it('getMockService always returns a MockNotificationService', () => {
    expect(getMockService()).toBeInstanceOf(MockNotificationService);
  });
});

describe('TelegramNotificationService.send', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('returns success with a messageId on a 200 OK response', async () => {
    const svc = new TelegramNotificationService();
    svc.token = 'test-token';
    svc.apiUrl = 'https://api.telegram.org/bottest-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });

    const result = await svc.send('chat_1', 'hello');

    expect(result).toEqual({ success: true, messageId: 42 });
  });

  it('never throws — returns an error object when fetch rejects', async () => {
    const svc = new TelegramNotificationService();
    svc.token = 'test-token';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await svc.send('chat_1', 'hello');

    expect(result.success).toBe(false);
    expect(result.error).toBe('network down');
  });

  it('returns an error object when the Telegram API rejects the request', async () => {
    const svc = new TelegramNotificationService();
    svc.token = 'test-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, description: 'chat not found' }),
    });

    const result = await svc.send('bad_chat', 'hello');

    expect(result.success).toBe(false);
    expect(result.error).toBe('chat not found');
  });

  it('returns an error when no bot token is configured', async () => {
    const svc = new TelegramNotificationService();
    svc.token = undefined;

    const result = await svc.send('chat_1', 'hello');

    expect(result.success).toBe(false);
  });
});
