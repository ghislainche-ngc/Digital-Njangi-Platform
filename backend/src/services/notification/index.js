'use strict';

const TelegramNotificationService = require('./TelegramNotificationService');
const SMSNotificationService = require('./SMSNotificationService');

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
 * Primary: Telegram. Fallback: SMS.
 */
const getTelegramService = () => new TelegramNotificationService();
const getSMSService = () => new SMSNotificationService();

module.exports = { getTelegramService, getSMSService, templates };
