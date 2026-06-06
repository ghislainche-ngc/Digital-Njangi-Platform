'use strict';

const { supabase } = require('../../config/supabase');

class TelegramBotService {
  constructor() {
    this.token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    this.offset = 0;
    this.isRunning = false;
  }

  start() {
    if (!this.token) {
      console.warn('[Telegram Bot] TELEGRAM_BOT_TOKEN not configured. Automatic link bot will not start.');
      return;
    }
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Telegram Bot] Starting long polling listener...');
    this._poll();
  }

  stop() {
    this.isRunning = false;
  }

  async _poll() {
    while (this.isRunning) {
      try {
        const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=30`;
        const res = await fetch(url);
        if (!res.ok) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        
        const data = await res.json();
        if (data.ok && data.result && data.result.length > 0) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            await this._handleUpdate(update);
          }
        }
      } catch (err) {
        console.error('[Telegram Bot] Polling error:', err.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  async _handleUpdate(update) {
    const message = update.message;
    if (!message || !message.text) return;

    const text = message.text.trim();
    const chatId = message.chat.id;

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        await this._sendMessage(chatId, 'Welcome to NjangiBridge! To link your account, please click the "Open @Bot" button inside your profile settings on our website.');
        return;
      }

      const userId = parts[1];
      console.log(`[Telegram Bot] Linking chatId ${chatId} for userId ${userId}`);

      try {
        const { data, error } = await supabase
          .from('users')
          .update({ telegram_chat_id: String(chatId) })
          .eq('id', userId)
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          const name = data[0].full_name || 'Member';
          await this._sendMessage(chatId, `Hello ${name}! 🎉 Your Telegram account has been successfully linked to your NjangiBridge profile. You will now receive instant alerts for contributions, payouts, and meeting notices here.`);
        } else {
          await this._sendMessage(chatId, 'Error linking account: User ID not found on our system.');
        }
      } catch (err) {
        console.error('[Telegram Bot] Database error during linking:', err.message);
        await this._sendMessage(chatId, 'Failed to link account. Please contact support.');
      }
    }
  }

  async _sendMessage(chatId, text) {
    try {
      await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });
    } catch (err) {
      console.error('[Telegram Bot] Send message error:', err.message);
    }
  }
}

module.exports = new TelegramBotService();
