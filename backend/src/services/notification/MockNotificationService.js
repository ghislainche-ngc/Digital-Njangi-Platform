'use strict';

const NotificationService = require('./NotificationService');

/**
 * MockNotificationService — logs messages to the console instead of calling
 * any external API. Used for local development and tests so no real Telegram
 * or SMS traffic is generated.
 *
 * Sent messages are kept in the `sent` array so tests can assert on them.
 *
 * OOP: Demonstrates Polymorphism — drop-in replacement for the real services
 * through the shared NotificationService interface.
 *
 * @task Dev C — Task C-01
 */
class MockNotificationService extends NotificationService {
  constructor() {
    super();
    /** @type {Array<{recipient: string, message: string}>} */
    this.sent = [];
  }

  async send(recipient, message) {
    this.sent.push({ recipient, message });
    // eslint-disable-next-line no-console
    console.log(`[MockNotification] → ${recipient}: ${message}`);
    return { success: true, messageId: `mock-${this.sent.length}` };
  }
}

module.exports = MockNotificationService;
