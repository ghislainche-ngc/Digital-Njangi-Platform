'use strict';

const { supabase } = require('../../config/supabase');
const { getNotificationService } = require('../../services/notification');

class AnnouncementsService {
  /**
   * List announcements for a specific Njangi group.
   * @param {string} groupId
   * @returns {Promise<Array>}
   */
  async listAnnouncements(groupId) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, users:created_by(full_name, email)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create an announcement and broadcast it via Telegram or SMS.
   * @param {string} groupId
   * @param {string} title
   * @param {string} body
   * @param {Array<string>} channels - e.g. ['Telegram', 'SMS']
   * @param {string} userId - creator
   * @returns {Promise<object>}
   */
  async createAnnouncement(groupId, title, body, channels, userId) {
    // 1. Insert announcement
    const { data: announcement, error: insertError } = await supabase
      .from('announcements')
      .insert({
        group_id: groupId,
        title,
        body,
        channel: channels.join(' + ') || 'In-app only',
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Fetch group name for branding
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('name')
      .eq('id', groupId)
      .single();

    const groupName = group?.name || 'Njangi group';

    // 3. Fetch active members with phone & telegram_chat_id
    const { data: memberships } = await supabase
      .from('memberships')
      .select('*, users(phone, telegram_chat_id)')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const activeMembers = (memberships || [])
      .map((m) => m.users)
      .filter(Boolean);

    // 4. Send Telegram Broadcast
    if (channels.includes('Telegram')) {
      const telegramService = getNotificationService('telegram');
      const chatIds = activeMembers
        .map((m) => m.telegram_chat_id)
        .filter(Boolean);

      if (chatIds.length > 0) {
        const message = `<b>📢 ${title}</b>\n\n${body}\n\n<i>— ${groupName}</i>`;
        // sendBulk is non-blocking to prevent route delay
        telegramService.sendBulk(chatIds, message, 'telegram').catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[Telegram Broadcast] Error:', err.message);
        });
      }
    }

    // 5. Send SMS Broadcast (fallback)
    if (channels.includes('SMS')) {
      const smsService = getNotificationService('sms');
      const phones = activeMembers
        .map((m) => m.phone)
        .filter(Boolean);

      if (phones.length > 0) {
        const message = `📢 ${title}: ${body} — ${groupName}`;
        smsService.sendBulk(phones, message, 'sms').catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[SMS Broadcast] Error:', err.message);
        });
      }
    }

    return announcement;
  }

  /**
   * Delete an announcement.
   * @param {string} groupId
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteAnnouncement(groupId, id) {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
      .eq('group_id', groupId);

    if (error) throw error;
    return true;
  }
}

module.exports = new AnnouncementsService();
