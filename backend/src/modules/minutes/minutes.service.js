'use strict';

const { supabase } = require('../../config/supabase');
const { getNotificationService } = require('../../services/notification');

class MinutesService {
  /**
   * List meeting minutes for a specific Njangi group.
   * @param {string} groupId
   * @returns {Promise<Array>}
   */
  async listMinutes(groupId) {
    const { data, error } = await supabase
      .from('meeting_minutes')
      .select('*, users:created_by(full_name, email)')
      .eq('group_id', groupId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create meeting minutes.
   * @param {string} groupId
   * @param {object} payload
   * @param {string} userId - creator
   * @returns {Promise<object>}
   */
  async createMinutes(groupId, payload, userId) {
    const { title, date, attendees, pages, status, description } = payload;

    const { data: minutes, error: insertError } = await supabase
      .from('meeting_minutes')
      .insert({
        group_id: groupId,
        title,
        date,
        attendees: parseInt(attendees) || 0,
        pages: parseInt(pages) || 1,
        status: status || 'draft',
        description,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (minutes.status === 'published') {
      this._broadcastMinutes(groupId, minutes.title, minutes.date).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[Minutes Broadcast] Error:', err.message);
      });
    }

    return minutes;
  }

  /**
   * Update status of meeting minutes.
   * @param {string} groupId
   * @param {string} id
   * @param {string} status - 'draft' | 'published'
   * @returns {Promise<object>}
   */
  async updateMinutesStatus(groupId, id, status) {
    // 1. Get current minutes details to check status transition
    const { data: current, error: fetchError } = await supabase
      .from('meeting_minutes')
      .select('*')
      .eq('id', id)
      .eq('group_id', groupId)
      .single();

    if (fetchError || !current) {
      throw new Error('Meeting minutes not found.');
    }

    // 2. Update status
    const { data: updated, error: updateError } = await supabase
      .from('meeting_minutes')
      .update({ status })
      .eq('id', id)
      .eq('group_id', groupId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Broadcast if transitioning from draft to published
    if (current.status !== 'published' && status === 'published') {
      this._broadcastMinutes(groupId, updated.title, updated.date).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[Minutes Broadcast] Error:', err.message);
      });
    }

    return updated;
  }

  /**
   * Delete meeting minutes.
   * @param {string} groupId
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteMinutes(groupId, id) {
    const { error } = await supabase
      .from('meeting_minutes')
      .delete()
      .eq('id', id)
      .eq('group_id', groupId);

    if (error) throw error;
    return true;
  }

  /**
   * Private helper to broadcast published meeting minutes to Telegram chat IDs.
   */
  async _broadcastMinutes(groupId, title, date) {
    // 1. Fetch group details
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('name')
      .eq('id', groupId)
      .single();

    const groupName = group?.name || 'Njangi group';

    // 2. Fetch active members with telegram_chat_ids
    const { data: memberships } = await supabase
      .from('memberships')
      .select('*, users(telegram_chat_id)')
      .eq('group_id', groupId)
      .eq('status', 'active');

    const chatIds = (memberships || [])
      .map((m) => m.users?.telegram_chat_id)
      .filter(Boolean);

    if (chatIds.length === 0) return;

    // 3. Broadcast
    const telegramService = getNotificationService('telegram');
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const message = `<b>📄 Meeting Minutes Published</b>\n\nMinutes for "<i>${title}</i>" (${formattedDate}) are now available in the Minutes tab.\n\n<i>— ${groupName}</i>`;

    await telegramService.sendBulk(chatIds, message, 'telegram');
  }
}

module.exports = new MinutesService();
