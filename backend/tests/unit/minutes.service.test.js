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
const minutesService = require('../../src/modules/minutes/minutes.service');

function chainMock(finalData = null, finalError = null) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: finalData, error: finalError });
  
  const countPromise = Promise.resolve({ data: finalData, error: finalError });
  chain.then = countPromise.then.bind(countPromise);
  chain.catch = countPromise.catch.bind(countPromise);
  return chain;
}

describe('MinutesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listMinutes', () => {
    it('returns list of minutes', async () => {
      const data = [{ id: 'm1', title: 'Minutes' }];
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data, error: null })
          })
        })
      });

      const res = await minutesService.listMinutes('g1');
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

      await expect(minutesService.listMinutes('g1')).rejects.toThrow('Database error');
    });
  });

  describe('createMinutes', () => {
    it('creates draft minutes without broadcasting', async () => {
      const minutes = { id: 'm1', title: 'Meeting 1', status: 'draft' };
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: minutes, error: null })
          })
        })
      });

      const res = await minutesService.createMinutes('g1', { title: 'Meeting 1', status: 'draft' }, 'u1');
      expect(res).toEqual(minutes);
      expect(mockSendBulk).not.toHaveBeenCalled();
    });

    it('creates published minutes and broadcasts', async () => {
      const minutes = { id: 'm1', title: 'Meeting 1', date: '2026-06-04', status: 'published' };
      mockFrom.mockImplementation((table) => {
        if (table === 'meeting_minutes') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: minutes, error: null })
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
                    { users: { telegram_chat_id: 'chat1' } }
                  ],
                  error: null
                })
              })
            })
          };
        }
        return chainMock();
      });

      const res = await minutesService.createMinutes('g1', { title: 'Meeting 1', date: '2026-06-04', status: 'published' }, 'u1');
      expect(res).toEqual(minutes);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendBulk).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMinutesStatus', () => {
    it('updates status and broadcasts if transitioning from draft to published', async () => {
      const current = { id: 'm1', title: 'Meeting 1', date: '2026-06-04', status: 'draft' };
      const updated = { id: 'm1', title: 'Meeting 1', date: '2026-06-04', status: 'published' };

      mockFrom.mockImplementation((table) => {
        if (table === 'meeting_minutes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: current, error: null })
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: updated, error: null })
                  })
                })
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
                    { users: { telegram_chat_id: 'chat1' } }
                  ],
                  error: null
                })
              })
            })
          };
        }
        return chainMock();
      });

      const res = await minutesService.updateMinutesStatus('g1', 'm1', 'published');
      expect(res).toEqual(updated);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockSendBulk).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteMinutes', () => {
    it('deletes minutes successfully', async () => {
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const res = await minutesService.deleteMinutes('g1', 'm1');
      expect(res).toBe(true);
    });
  });
});
