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
   * Send a message via the Telegram Bot API.
   * NEVER throws — returns an error object so sendBulk() keeps going.
   *
   * @param {string} chatId — user's Telegram chat_id (stored in users.telegram_chat_id)
   * @param {string} message
   * @returns {Promise<{success: boolean, messageId?: number, error?: string}>}
   */
  async send(chatId, message) {
    if (!this.token) {
      return { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      });

      const body = await response.json();

      if (!response.ok || !body.ok) {
        return { success: false, error: body.description || `HTTP ${response.status}` };
      }

      return { success: true, messageId: body.result.message_id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = TelegramNotificationService;
