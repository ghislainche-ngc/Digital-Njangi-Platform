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
    try {
      const axios = require('axios');
      const url = `${this.apiUrl}/sendMessage`;

      const response = await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });

      return {
        success: true,
        messageId: response.data.result.message_id
      };
    } catch (error) {
      console.error('Telegram Error:', error.response?.data || error.message);

      // We return success: false instead of throwing to keep the system running
      return {
        success: false,
        error: error.response?.data?.description || error.message
      };
    }
  }
}

module.exports = TelegramNotificationService;
