'use strict';

process.env.NODE_ENV = 'test';

jest.mock('../../src/config/supabase', () => {
  const mockFrom = jest.fn();
  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

jest.mock('../../src/services/notification', () => {
  const mockSendBulk = jest.fn().mockResolvedValue(true);
  const mockGet = jest.fn().mockReturnValue({
    sendBulk: mockSendBulk,
  });
  return {
    getNotificationService: mockGet,
    __mockSendBulk: mockSendBulk,
  };
});

const { __mockFrom: mockFrom } = require('../../src/config/supabase');
const { __mockSendBulk: mockSendBulk } = require('../../src/services/notification');
const announcementsService = require('../../src/modules/announcements/announcements.service');

function chainMock(finalData = null, finalError = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });
  
  const countPromise = Promise.resolve({ data: finalData, error: finalError });
  chain.then = countPromise.then.bind(countPromise);
  chain.catch = countPromise.catch.bind(countPromise);
  return chain;
}

describe('AnnouncementsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAnnouncements', () => {
    it('returns list of announcements', async () => {
      const data = [{ id: 'a1', title: 'Welcome' }];
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data, error: null })
          })
        })
      });

      const res = await announcementsService.listAnnouncements('g1');
      expect(res).toEqual(data);
    });

    it('throws error when select fails', async () => {
      const error = new Error('Database error');
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: null, error })
          })
        })
      });

      await expect(announcementsService.listAnnouncements('g1')).rejects.toThrow('Database error');
    });
  });

  describe('createAnnouncement', () => {
    it('creates announcement and broadcasts via Telegram and SMS', async () => {
      const announcement = { id: 'a1', title: 'Hello', body: 'World', channel: 'Telegram + SMS' };
      mockFrom.mockImplementation((table) => {
        if (table === 'announcements') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: announcement, error: null })
              })
            })
          };
        }
        if (table === 'njangi_groups') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { name: 'My Njangi' }, error: null })
              })
            })
          };
        }
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    { users: { phone: '+237600000001', telegram_chat_id: 'chat1' } }
                  ],
                  error: null
                })
              })
            })
          };
        }
        return chainMock();
      });

      const res = await announcementsService.createAnnouncement('g1', 'Hello', 'World', ['Telegram', 'SMS'], 'u1');
      expect(res).toEqual(announcement);
      
      // Allow async background broadcast catches to execute
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendBulk).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteAnnouncement', () => {
    it('deletes the announcement successfully', async () => {
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const res = await announcementsService.deleteAnnouncement('g1', 'a1');
      expect(res).toBe(true);
    });

    it('throws error when delete fails', async () => {
      const error = new Error('Delete failed');
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error })
          })
        })
      });

      await expect(announcementsService.deleteAnnouncement('g1', 'a1')).rejects.toThrow('Delete failed');
    });
  });
});
