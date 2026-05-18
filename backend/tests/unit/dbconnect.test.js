'use strict';

/**
 * Unit tests for DBConnect — OOP Supabase connection wrapper.
 *
 * The Supabase SDK is fully mocked so no network calls happen. `createClient`
 * is a jest.fn() returning a controllable fake client whose `.from()` yields a
 * chainable, thenable query-builder mock.
 */

// ─── Mock the Supabase SDK ──────────────────────────────────────────────────
jest.mock('@supabase/supabase-js');

const { createClient } = require('@supabase/supabase-js');
const DBConnect = require('../../src/config/DBConnect');

/**
 * Builds a chainable, await-able query-builder mock.
 * Every chain method (select/insert/update/delete/eq/order/limit) returns the
 * builder itself. The builder is thenable and resolves to `result`. `.single()`
 * resolves to `singleResult` (defaults to `result`).
 *
 * @param {object} result        - final awaited value, e.g. { data, error, count }
 * @param {object} [singleResult] - value resolved by `.single()`
 */
function makeBuilder(result = { data: null, error: null }, singleResult) {
  const builder = {
    select: jest.fn(function () { return this; }),
    insert: jest.fn(function () { return this; }),
    update: jest.fn(function () { return this; }),
    delete: jest.fn(function () { return this; }),
    eq: jest.fn(function () { return this; }),
    order: jest.fn(function () { return this; }),
    limit: jest.fn(function () { return this; }),
    single: jest.fn(function () {
      return Promise.resolve(singleResult !== undefined ? singleResult : result);
    }),
    // Make the builder thenable so `await builder` resolves to `result`.
    then: function (resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}

/**
 * Builds a fake Supabase client whose `.from()` always returns `builder`.
 */
function makeClient(builder) {
  return { from: jest.fn(() => builder) };
}

const URL = 'https://example.supabase.co';
const KEY = 'service-role-key-123';

describe('DBConnect', () => {
  let builder;
  let client;

  beforeEach(() => {
    DBConnect._resetInstance();
    createClient.mockReset();
    builder = makeBuilder({ data: [], error: null });
    client = makeClient(builder);
    createClient.mockReturnValue(client);
  });

  // ─── Constructor ──────────────────────────────────────────────────────────
  describe('constructor', () => {
    it('throws when username is missing', () => {
      expect(() => new DBConnect(undefined, KEY)).toThrow(/\[DBConnect\]/);
      expect(() => new DBConnect(undefined, KEY)).toThrow(/credentials required/i);
    });

    it('throws when password is missing', () => {
      expect(() => new DBConnect(URL, undefined)).toThrow(/\[DBConnect\]/);
      expect(() => new DBConnect(URL, undefined)).toThrow(/credentials required/i);
    });

    it('throws when both credentials are missing', () => {
      expect(() => new DBConnect()).toThrow(/credentials required/i);
      expect(() => new DBConnect('', '')).toThrow(/credentials required/i);
    });

    it('succeeds with valid credentials and reports connected', () => {
      const db = new DBConnect(URL, KEY);
      expect(db).toBeInstanceOf(DBConnect);
      expect(db.isConnected()).toBe(true);
    });

    it('creates the Supabase client with the supplied url and key', () => {
      // eslint-disable-next-line no-new
      new DBConnect(URL, KEY);
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(createClient).toHaveBeenCalledWith(URL, KEY);
    });
  });

  // ─── Singleton ────────────────────────────────────────────────────────────
  describe('getInstance / _resetInstance', () => {
    it('returns the same instance on repeated calls', () => {
      const a = DBConnect.getInstance(URL, KEY);
      const b = DBConnect.getInstance(URL, KEY);
      expect(a).toBe(b);
      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it('_resetInstance forces a new instance to be created', () => {
      const a = DBConnect.getInstance(URL, KEY);
      DBConnect._resetInstance();
      const b = DBConnect.getInstance(URL, KEY);
      expect(a).not.toBe(b);
      expect(createClient).toHaveBeenCalledTimes(2);
    });
  });

  // ─── getClient / from ─────────────────────────────────────────────────────
  describe('getClient / from', () => {
    it('getClient returns the underlying Supabase client', () => {
      const db = new DBConnect(URL, KEY);
      expect(db.getClient()).toBe(client);
    });

    it('from returns the query builder for the given table', () => {
      const db = new DBConnect(URL, KEY);
      const qb = db.from('users');
      expect(client.from).toHaveBeenCalledWith('users');
      expect(qb).toBe(builder);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────
  describe('create', () => {
    it('returns the inserted rows on success', async () => {
      const rows = [{ id: 1, name: 'Jane' }];
      builder = makeBuilder({ data: rows, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.create('users', { name: 'Jane' });

      expect(result).toEqual(rows);
      expect(client.from).toHaveBeenCalledWith('users');
      expect(builder.insert).toHaveBeenCalledWith({ name: 'Jane' });
      expect(builder.select).toHaveBeenCalled();
    });

    it('throws a wrapped error mentioning CREATE and the table on failure', async () => {
      builder = makeBuilder({
        data: null,
        error: { message: 'boom', code: 'XX000', details: 'd', hint: 'h' },
      });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.create('users', {})).rejects.toThrow(/\[DBConnect\]/);
      await expect(db.create('users', {})).rejects.toThrow(/CREATE/);
      await expect(db.create('users', {})).rejects.toThrow(/users/);
    });

    it('wrapped error carries code/details/hint and statusCode 409 for code 23505', async () => {
      builder = makeBuilder({
        data: null,
        error: { message: 'dup', code: '23505', details: 'unique', hint: 'use new value' },
      });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.create('users', {})).rejects.toMatchObject({
        code: '23505',
        details: 'unique',
        hint: 'use new value',
        statusCode: 409,
      });
    });

    it('wrapped error has statusCode 500 for a non-23505 error code', async () => {
      builder = makeBuilder({
        data: null,
        error: { message: 'fail', code: 'XX000' },
      });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.create('users', {})).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns data and selects all columns by default', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      builder = makeBuilder({ data: rows, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.findAll('groups');

      expect(result).toEqual(rows);
      expect(builder.select).toHaveBeenCalledWith('*');
    });

    it('applies filters, custom columns, ordering and limit', async () => {
      builder = makeBuilder({ data: [], error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await db.findAll(
        'groups',
        { status: 'active', owner: 'u1' },
        { columns: 'id,name', orderBy: 'created_at', ascending: false, limit: 5 },
      );

      expect(builder.select).toHaveBeenCalledWith('id,name');
      expect(builder.eq).toHaveBeenCalledWith('status', 'active');
      expect(builder.eq).toHaveBeenCalledWith('owner', 'u1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(5);
    });

    it('throws a wrapped error mentioning FIND_ALL on failure', async () => {
      builder = makeBuilder({ data: null, error: { message: 'bad', code: 'XX000' } });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.findAll('groups')).rejects.toThrow(/FIND_ALL/);
      await expect(db.findAll('groups')).rejects.toThrow(/groups/);
    });
  });

  // ─── findOne / findById ───────────────────────────────────────────────────
  describe('findOne / findById', () => {
    it('returns the matching row', async () => {
      const row = { id: 7, email: 'a@b.com' };
      builder = makeBuilder({ data: null, error: null }, { data: row, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.findOne('users', { email: 'a@b.com' });

      expect(result).toEqual(row);
      expect(builder.eq).toHaveBeenCalledWith('email', 'a@b.com');
      expect(builder.single).toHaveBeenCalled();
    });

    it('returns null when the error code is PGRST116 (no rows)', async () => {
      builder = makeBuilder(
        { data: null, error: null },
        { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      );
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.findOne('users', { id: 'missing' });
      expect(result).toBeNull();
    });

    it('throws a wrapped error for non-PGRST116 errors', async () => {
      builder = makeBuilder(
        { data: null, error: null },
        { data: null, error: { code: 'XX000', message: 'kaboom' } },
      );
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.findOne('users', { id: '1' })).rejects.toThrow(/FIND_ONE/);
    });

    it('findById delegates to findOne filtering by { id }', async () => {
      const row = { id: 'abc', name: 'X' };
      builder = makeBuilder({ data: null, error: null }, { data: row, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const spy = jest.spyOn(db, 'findOne');
      const result = await db.findById('users', 'abc', 'id,name');

      expect(result).toEqual(row);
      expect(spy).toHaveBeenCalledWith('users', { id: 'abc' }, 'id,name');
      expect(builder.eq).toHaveBeenCalledWith('id', 'abc');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────
  describe('update', () => {
    it('returns the updated rows on success', async () => {
      const rows = [{ id: 1, name: 'New' }];
      builder = makeBuilder({ data: rows, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.update('users', { id: 1 }, { name: 'New' });

      expect(result).toEqual(rows);
      expect(builder.update).toHaveBeenCalledWith({ name: 'New' });
      expect(builder.eq).toHaveBeenCalledWith('id', 1);
      expect(builder.select).toHaveBeenCalled();
    });

    it('throws a wrapped error mentioning UPDATE on failure', async () => {
      builder = makeBuilder({ data: null, error: { message: 'no', code: 'XX000' } });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.update('users', { id: 1 }, {})).rejects.toThrow(/UPDATE/);
      await expect(db.update('users', { id: 1 }, {})).rejects.toThrow(/users/);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('returns the deleted rows on success', async () => {
      const rows = [{ id: 9 }];
      builder = makeBuilder({ data: rows, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.remove('users', { id: 9 });

      expect(result).toEqual(rows);
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 9);
      expect(builder.select).toHaveBeenCalled();
    });

    it('throws a wrapped error mentioning DELETE on failure', async () => {
      builder = makeBuilder({ data: null, error: { message: 'no', code: 'XX000' } });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.remove('users', { id: 1 })).rejects.toThrow(/DELETE/);
    });
  });

  // ─── count ────────────────────────────────────────────────────────────────
  describe('count', () => {
    it('returns the exact count on success', async () => {
      builder = makeBuilder({ data: null, count: 42, error: null });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      const result = await db.count('users', { status: 'active' });

      expect(result).toBe(42);
      expect(builder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('throws a wrapped error mentioning COUNT on failure', async () => {
      builder = makeBuilder({ data: null, count: null, error: { message: 'x', code: 'XX000' } });
      client = makeClient(builder);
      createClient.mockReturnValue(client);

      const db = new DBConnect(URL, KEY);
      await expect(db.count('users')).rejects.toThrow(/COUNT/);
    });
  });

  // ─── Connection management ────────────────────────────────────────────────
  describe('disconnect / reconnect', () => {
    it('disconnect sets isConnected to false', () => {
      const db = new DBConnect(URL, KEY);
      expect(db.isConnected()).toBe(true);
      db.disconnect();
      expect(db.isConnected()).toBe(false);
    });

    it('getClient throws "Not connected" after disconnect', () => {
      const db = new DBConnect(URL, KEY);
      db.disconnect();
      expect(() => db.getClient()).toThrow(/Not connected/);
    });

    it('from throws "Not connected" after disconnect', () => {
      const db = new DBConnect(URL, KEY);
      db.disconnect();
      expect(() => db.from('users')).toThrow(/Not connected/);
    });

    it('create rejects with "Not connected" after disconnect', async () => {
      const db = new DBConnect(URL, KEY);
      db.disconnect();
      await expect(db.create('users', {})).rejects.toThrow(/Not connected/);
    });

    it('findAll rejects with "Not connected" after disconnect', async () => {
      const db = new DBConnect(URL, KEY);
      db.disconnect();
      await expect(db.findAll('users')).rejects.toThrow(/Not connected/);
    });

    it('reconnect restores connectivity and recreates the client', () => {
      const db = new DBConnect(URL, KEY);
      db.disconnect();
      expect(db.isConnected()).toBe(false);

      db.reconnect();
      expect(db.isConnected()).toBe(true);
      // createClient called once in constructor, once in reconnect.
      expect(createClient).toHaveBeenCalledTimes(2);
      expect(createClient).toHaveBeenLastCalledWith(URL, KEY);
    });

    it('CRUD works again after reconnect', async () => {
      const db = new DBConnect(URL, KEY);
      db.disconnect();

      const rows = [{ id: 1 }];
      const newBuilder = makeBuilder({ data: rows, error: null });
      createClient.mockReturnValue(makeClient(newBuilder));

      db.reconnect();
      const result = await db.findAll('users');
      expect(result).toEqual(rows);
    });
  });
});
