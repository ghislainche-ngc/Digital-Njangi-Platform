'use strict';

/**
 * NotificationService — abstract base class.
 *
 * OOP: Demonstrates Abstraction and Inheritance.
 * TelegramNotificationService and SMSNotificationService extend this class.
 *
 * @task Dev C — Task C-01
 */
class NotificationService {
  constructor() {
    if (new.target === NotificationService) {
      throw new Error('NotificationService is abstract and cannot be instantiated directly.');
    }
  }

  /**
   * Send a message to a single user.
   * @param {string} recipient — phone number or Telegram chat ID
   * @param {string} message — message body
   * @param {string} channel — 'telegram' | 'sms'
   * @returns {Promise<void>}
   */
  async send(_recipient, _message, _channel = 'telegram') {
    throw new Error('send() must be implemented by subclass.');
  }

  /**
   * Send to multiple recipients. Does NOT throw if one fails.
   * Uses Promise.allSettled — each message is independent.
   */
  async sendBulk(recipients, message, channel = 'telegram') {
    const promises = recipients.map(r => this.send(r, message, channel));
    return Promise.allSettled(promises);
  }
}

module.exports = NotificationService;
