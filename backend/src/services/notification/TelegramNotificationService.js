'use strict';

const NotificationService = require('./NotificationService');

/**
 * TelegramNotificationService — primary notification channel.
 * Uses the Telegram Bot API to send messages to users who have
 * linked their Telegram account via the profile page.
 *
 * Bot API base URL: https://api.telegram.org/bot{TOKEN}/sendMessage
 *
 * @task Dev C — Task C-01
 */
class TelegramNotificationService extends NotificationService {
  constructor() {
    super();
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * @param {string} chatId — user's Telegram chat_id (stored in users.telegram_chat_id)
   * @param {string} message
   */
  async send(chatId, message) {
    // TODO (Dev C):
    // POST https://api.telegram.org/bot{TOKEN}/sendMessage
    // Body: { chat_id: chatId, text: message, parse_mode: 'HTML' }
    // Return { success: true, messageId } or { success: false, error }
    // NEVER throw — return error so sendBulk doesn't break
    void chatId; void message;
    throw new Error('Not implemented');
  }
}

module.exports = TelegramNotificationService;
