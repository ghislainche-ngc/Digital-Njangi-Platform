'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const NotificationService = require('./NotificationService');

let clientInstance = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, INITIALIZING, QR_READY, CONNECTED
let lastQrCode = '';

/**
 * WhatsAppNotificationService — delivers transactional alerts via programmatically linked WhatsApp device.
 * Bypasses Meta conversation fees entirely.
 *
 * Persists session credentials under `./.wwebjs_auth` directory.
 */
class WhatsAppNotificationService extends NotificationService {
  constructor() {
    super();
    this.initClient();
  }

  /**
   * Initializes the WhatsApp Web client if it hasn't been started already.
   */
  initClient() {
    if (process.env.NODE_ENV === 'test') {
      connectionStatus = 'DISCONNECTED';
      return;
    }
    if (clientInstance) return;

    connectionStatus = 'INITIALIZING';

    clientInstance = new Client({
      authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }
    });

    clientInstance.on('qr', (qr) => {
      connectionStatus = 'QR_READY';
      lastQrCode = qr;
      // eslint-disable-next-line no-console
      console.log('[WhatsApp Bot] Scan QR code at http://localhost:3000/auth/whatsapp/qr');
    });

    clientInstance.on('ready', () => {
      connectionStatus = 'CONNECTED';
      lastQrCode = '';
      // eslint-disable-next-line no-console
      console.log('[WhatsApp Bot] Linked and ready to send messages.');
    });

    clientInstance.on('auth_failure', (msg) => {
      connectionStatus = 'DISCONNECTED';
      lastQrCode = '';
      // eslint-disable-next-line no-console
      console.error('[WhatsApp Bot] Authentication failure:', msg);
    });

    clientInstance.on('disconnected', (reason) => {
      connectionStatus = 'DISCONNECTED';
      lastQrCode = '';
      // eslint-disable-next-line no-console
      console.log('[WhatsApp Bot] Disconnected:', reason);
      // Attempt to restart
      setTimeout(() => {
        try {
          clientInstance.initialize();
        } catch (e) {
          // Ignore restart failures
        }
      }, 5000);
    });

    clientInstance.initialize().catch((err) => {
      connectionStatus = 'DISCONNECTED';
      // eslint-disable-next-line no-console
      console.error('[WhatsApp Bot] Initialization error:', err.message);
    });
  }

  /**
   * Return the active connection state and current QR code payload.
   */
  static getStatus() {
    return {
      status: connectionStatus,
      qr: lastQrCode
    };
  }

  /**
   * Helper to format raw phone numbers into standard WhatsApp JID format.
   * e.g., "+237 677 000 001" -> "237677000001@c.us"
   */
  _formatJid(phone) {
    if (!phone) return null;
    // Strip non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Default country prefix for Cameroon if missing (starts with 6)
    if (cleaned.length === 9 && cleaned.startsWith('6')) {
      cleaned = '237' + cleaned;
    }
    
    return `${cleaned}@c.us`;
  }

  /**
   * Send WhatsApp message. Returns success status and handles failures gracefully.
   *
   * @param {string} phone
   * @param {string} message
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(phone, message) {
    if (connectionStatus !== 'CONNECTED') {
      return { success: false, error: `WhatsApp client is not connected (current: ${connectionStatus}).` };
    }

    const jid = this._formatJid(phone);
    if (!jid) {
      return { success: false, error: 'Invalid phone number format.' };
    }

    try {
      await clientInstance.sendMessage(jid, message);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = WhatsAppNotificationService;
