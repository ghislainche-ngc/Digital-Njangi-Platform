'use strict';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.NODE_ENV = 'test';

jest.mock('../../src/config/supabase', () => {
  const mockFrom = jest.fn();
  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

const { __mockFrom: mockFrom } = require('../../src/config/supabase');
const telegramBotService = require('../../src/services/notification/TelegramBotService');

function chainMock(finalData = null, finalError = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });
  chain.then = Promise.resolve({ data: finalData, error: finalError }).then.bind(Promise.resolve({ data: finalData, error: finalError }));
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TelegramBotService', () => {
  it('does not start long polling if no token configured', () => {
    const oldToken = telegramBotService.token;
    telegramBotService.token = null;
    telegramBotService.isRunning = false;
    
    telegramBotService.start();
    expect(telegramBotService.isRunning).toBe(false);
    
    telegramBotService.token = oldToken;
  });

  describe('_handleUpdate', () => {
    let fetchMock;
    beforeEach(() => {
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ ok: true })
      });
      globalThis.fetch = fetchMock;
    });

    it('handles empty start command and replies with help message', async () => {
      await telegramBotService._handleUpdate({
        update_id: 1,
        message: {
          chat: { id: 999 },
          text: '/start'
        }
      });

      expect(fetchMock).toHaveBeenCalled();
      const firstCallArgs = fetchMock.mock.calls[0];
      expect(firstCallArgs[0]).toContain('sendMessage');
      const body = JSON.parse(firstCallArgs[1].body);
      expect(body.text).toContain('Welcome to NjangiBridge');
    });

    it('links user telegram chat_id successfully when user ID is provided', async () => {
      mockFrom.mockReturnValue(chainMock([{ id: 'user-abc', full_name: 'Ghislain' }]));

      await telegramBotService._handleUpdate({
        update_id: 2,
        message: {
          chat: { id: 999 },
          text: '/start user-abc'
        }
      });

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(fetchMock).toHaveBeenCalled();
      const firstCallArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(firstCallArgs[1].body);
      expect(body.text).toContain(' Ghislain! 🎉 Your Telegram account has been successfully linked');
    });

    it('replies with error if user ID does not exist in database', async () => {
      mockFrom.mockReturnValue(chainMock([]));

      await telegramBotService._handleUpdate({
        update_id: 3,
        message: {
          chat: { id: 999 },
          text: '/start non-existent-user'
        }
      });

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(fetchMock).toHaveBeenCalled();
      const firstCallArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(firstCallArgs[1].body);
      expect(body.text).toContain('Error linking account');
    });
  });
});
