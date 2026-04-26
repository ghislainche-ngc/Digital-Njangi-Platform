'use strict';

const NotificationService = require('./NotificationService');

/**
 * SMSNotificationService — fallback channel for members without Telegram.
 * Uses Africa's Talking SMS API.
 *
 * @task Dev C — Task C-01
 */
class SMSNotificationService extends NotificationService {
  constructor() {
    super();
    // TODO (Dev C): initialize Africa's Talking client
    // const AfricasTalking = require('africastalking');
    // this.at = AfricasTalking({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
    // this.sms = this.at.SMS;
  }

  async send(phone, message) {
    // TODO (Dev C):
    // await this.sms.send({ to: [phone], message, from: process.env.AT_SENDER_ID })
    void phone; void message;
    throw new Error('Not implemented');
  }
}

module.exports = SMSNotificationService;
