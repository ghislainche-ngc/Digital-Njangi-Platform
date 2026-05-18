'use strict';

const NotificationService = require('./NotificationService');

/**
 * SMSNotificationService — fallback channel for members without Telegram.
 * Uses Twilio (already a project dependency) to deliver SMS.
 *
 * The Twilio client is created lazily on first send() so that importing
 * this module never fails when SMS credentials are absent (e.g. in tests).
 *
 * @task Dev C — Task C-01
 */
class SMSNotificationService extends NotificationService {
  constructor() {
    super();
    this._client = null;
  }

  /** @private Lazily build the Twilio client. */
  _getClient() {
    if (!this._client) {
      const twilio = require('twilio');
      this._client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return this._client;
  }

  /**
   * Send an SMS. NEVER throws — returns an error object so sendBulk() keeps going.
   *
   * @param {string} phone — recipient phone number in E.164 format
   * @param {string} message
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async send(phone, message) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return { success: false, error: 'Twilio credentials are not configured.' };
    }

    try {
      const result = await this._getClient().messages.create({
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: message,
      });
      return { success: true, messageId: result.sid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = SMSNotificationService;
