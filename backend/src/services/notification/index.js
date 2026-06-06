'use strict';

const TelegramNotificationService = require('./TelegramNotificationService');
const SMSNotificationService = require('./SMSNotificationService');
const MockNotificationService = require('./MockNotificationService');
const WhatsAppNotificationService = require('./WhatsAppNotificationService');

/**
 * Bilingual message templates (EN/FR).
 * Keep messages SHORT — Telegram and SMS both have practical limits.
 */
const templates = {
  paymentReminder: (name, amount, date) =>
    `Bonjour ${name} / Hello ${name},\n\n` +
    `Rappel: ${amount} FCFA dû pour votre Njangi le ${date}.\n` +
    `Reminder: ${amount} FCFA due for your Njangi on ${date}.\n\n— NjangiBridge`,

  paymentConfirmed: (name, amount) =>
    `✅ Paiement confirmé / Payment confirmed: ${amount} FCFA.\n` +
    `Merci ${name} / Thank you ${name}.`,

  paymentFailed: (name, amount) =>
    `❌ Paiement échoué / Payment failed: ${amount} FCFA.\n` +
    `Vérifiez votre solde MoMo / Check your MoMo balance.`,

  payoutSent: (groupName, recipientName, amount, nextName) =>
    `🎉 Njangi ${groupName}: ${recipientName} a reçu ${amount} FCFA.\n` +
    `Prochain / Next: ${nextName}.`,

  fraudAlert: (treasurerName) =>
    `⚠️ ALERTE: Le Trésorier ${treasurerName} a enregistré un paiement en espèces pour lui-même.\n` +
    `ALERT: Treasurer ${treasurerName} recorded a cash payment for themselves.`,

  fineApplied: (name, amount, reason) =>
    `⚠️ Amende / Fine: ${amount} FCFA → ${name}.\nRaison / Reason: ${reason}.`,

  inviteSent: (groupName, link) =>
    `Vous êtes invité(e) à rejoindre "${groupName}" sur NjangiBridge.\n` +
    `You are invited to join "${groupName}".\n\nClick: ${link}`,
};

/**
 * Factory — returns the appropriate notification service.
 * Primary: Telegram. Fallback: SMS. Tests/local dev: Mock.
 */
const getTelegramService = () => new TelegramNotificationService();
const getSMSService = () => new SMSNotificationService();
const getMockService = () => new MockNotificationService();
const getWhatsAppService = () => new WhatsAppNotificationService();

/**
 * Resolve the active notification service for the given channel.
 * Set NOTIFICATION_DRIVER=mock (or run tests) to swap in the mock — one line,
 * no other code changes. Demonstrates the factory pattern.
 *
 * @param {'telegram'|'sms'|'whatsapp'} [channel='telegram']
 * @returns {NotificationService}
 */
const getNotificationService = (channel = 'telegram') => {
  if (process.env.NOTIFICATION_DRIVER === 'mock' || process.env.NODE_ENV === 'test') {
    return getMockService();
  }
  if (process.env.NOTIFICATION_DRIVER === 'whatsapp') {
    return getWhatsAppService();
  }
  if (channel === 'whatsapp') {
    return getWhatsAppService();
  }
  return channel === 'sms' ? getSMSService() : getTelegramService();
};

module.exports = {
  getTelegramService,
  getSMSService,
  getMockService,
  getWhatsAppService,
  getNotificationService,
  templates,
};
