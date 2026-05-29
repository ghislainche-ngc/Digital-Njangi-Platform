'use strict';

const { createClient } = require('@supabase/supabase-js');

/**
 * DBConnect — OOP Database Connection Class
 *
 * Encapsulates all database access behind a single class with a clean interface.
 * The constructor accepts connection credentials (username/URL, password/serviceKey)
 * as required by the OOADI course specification.
 *
 * Design Patterns:
 *   - Singleton: Only one connection instance per set of credentials
 *   - Adapter: Wraps Supabase SDK behind a uniform CRUD interface
 *   - Encapsulation: Internal client is private; access only via public methods
 *
 * OOP Pillars demonstrated:
 *   - Encapsulation: Private fields (_client, _url, _serviceKey) hidden from consumers
 *   - Abstraction: Callers use simple CRUD methods, unaware of Supabase internals
 *
 * @example
 *   const db = DBConnect.getInstance(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
 *   const users = await db.findAll('users');
 *   const user  = await db.findOne('users', { email: 'john@example.com' });
 *   const created = await db.create('users', { email: 'jane@example.com', full_name: 'Jane' });
 *   const updated = await db.update('users', { id: '...' }, { full_name: 'Updated Name' });
 *   await db.remove('users', { id: '...' });
 */
class DBConnect {
  /** @type {DBConnect|null} Singleton instance */
  static _instance = null;

  /**
   * Creates a new database connection.
   * @param {string} username - The database connection URL (Supabase project URL)
   * @param {string} password - The database service key (Supabase service-role key)
   * @throws {Error} If credentials are missing or invalid
   */
  constructor(username, password) {
    if (!username || !password) {
      throw new Error(
        '[DBConnect] Connection credentials required.\n' +
        'Usage: new DBConnect(SUPABASE_URL, SUPABASE_SERVICE_KEY)'
      );
    }

    /** @private */
    this._url = username;
    /** @private */
    this._serviceKey = password;
    /** @private */
    this._client = createClient(this._url, this._serviceKey);
    /** @private */
    this._connected = true;

    Object.freeze(this._url);
    Object.freeze(this._serviceKey);
  }

  /**
   * Singleton accessor — returns the single shared DBConnect instance.
   * Creates one on first call; returns the same instance on subsequent calls.
   *
   * @param {string} username - The database connection URL
   * @param {string} password - The database service key
   * @returns {DBConnect}
   */
  static getInstance(username, password) {
    if (!DBConnect._instance) {
      DBConnect._instance = new DBConnect(username, password);
    }
    return DBConnect._instance;
  }

  /**
   * Resets the singleton (for testing only).
   * @private
   */
  static _resetInstance() {
    DBConnect._instance = null;
  }

  /**
   * Returns the raw Supabase client for advanced queries.
   * Prefer the CRUD methods below for standard operations.
   * @returns {import('@supabase/supabase-js').SupabaseClient}
   */
  getClient() {
    this._ensureConnected();
    return this._client;
  }

  /**
   * Returns a Supabase query builder for the given table.
   * @param {string} table - Table name
   * @returns {import('@supabase/supabase-js').PostgrestQueryBuilder}
   */
  from(table) {
    this._ensureConnected();
    return this._client.from(table);
  }

  // ─── CRUD Operations ───────────────────────────────────────────────────

  /**
   * INSERT — Create one or more records in a table.
   * @param {string} table - Target table name
   * @param {object|object[]} data - Record(s) to insert
   * @param {object} [_options] - Reserved: { returning: 'minimal' | 'representation' }
   * @returns {Promise<object[]>} The inserted record(s)
   * @throws {Error} On database error
   */
  async create(table, data, _options = {}) {
    this._ensureConnected();
    const query = this._client.from(table).insert(data).select();

    const { data: result, error } = await query;
    if (error) throw this._wrapError('CREATE', table, error);
    return result;
  }

  /**
   * SELECT — Find all records matching optional filters.
   * @param {string} table - Table name
   * @param {object} [filters={}] - Key-value equality filters (e.g. { status: 'active' })
   * @param {object} [options={}] - { columns: 'id,name', orderBy: 'created_at', ascending: false, limit: 10 }
   * @returns {Promise<object[]>} Matching records
   */
  async findAll(table, filters = {}, options = {}) {
    this._ensureConnected();
    let query = this._client.from(table).select(options.columns || '*');

    // Apply equality filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending !== false });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw this._wrapError('FIND_ALL', table, error);
    return data;
  }

  /**
   * SELECT — Find a single record matching filters.
   * @param {string} table - Table name
   * @param {object} filters - Key-value equality filters
   * @param {string} [columns='*'] - Columns to select
   * @returns {Promise<object|null>} The matching record or null
   */
  async findOne(table, filters = {}, columns = '*') {
    this._ensureConnected();
    let query = this._client.from(table).select(columns);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.single();
    if (error && error.code === 'PGRST116') return null; // No rows found
    if (error) throw this._wrapError('FIND_ONE', table, error);
    return data;
  }

  /**
   * SELECT by primary key — Find a single record by its ID.
   * @param {string} table - Table name
   * @param {string} id - Primary key value
   * @param {string} [columns='*'] - Columns to select
   * @returns {Promise<object|null>}
   */
  async findById(table, id, columns = '*') {
    return this.findOne(table, { id }, columns);
  }

  /**
   * UPDATE — Update records matching filters.
   * @param {string} table - Table name
   * @param {object} filters - Key-value equality filters to identify records
   * @param {object} data - Fields to update
   * @returns {Promise<object[]>} Updated record(s)
   * @throws {Error} On database error
   */
  async update(table, filters, data) {
    this._ensureConnected();
    let query = this._client.from(table).update(data);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data: result, error } = await query.select();
    if (error) throw this._wrapError('UPDATE', table, error);
    return result;
  }

  /**
   * DELETE — Remove records matching filters.
   * @param {string} table - Table name
   * @param {object} filters - Key-value equality filters
   * @returns {Promise<object[]>} Deleted record(s)
   * @throws {Error} On database error
   */
  async remove(table, filters) {
    this._ensureConnected();
    let query = this._client.from(table).delete();

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.select();
    if (error) throw this._wrapError('DELETE', table, error);
    return data;
  }

  /**
   * COUNT — Count records matching optional filters.
   * @param {string} table - Table name
   * @param {object} [filters={}] - Key-value equality filters
   * @returns {Promise<number>}
   */
  async count(table, filters = {}) {
    this._ensureConnected();
    let query = this._client.from(table).select('*', { count: 'exact', head: true });

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { count, error } = await query;
    if (error) throw this._wrapError('COUNT', table, error);
    return count;
  }

  // ─── Connection Management ─────────────────────────────────────────────

  /**
   * Check if the database connection is active.
   * @returns {boolean}
   */
  isConnected() {
    return this._connected;
  }

  /**
   * Disconnect — marks the connection as closed.
   * After calling disconnect(), all CRUD methods will throw.
   */
  disconnect() {
    this._connected = false;
    this._client = null;
  }

  /**
   * Reconnect — re-establishes the database connection using stored credentials.
   */
  reconnect() {
    this._client = createClient(this._url, this._serviceKey);
    this._connected = true;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  /**
   * Guard that throws if the connection is not active.
   * @private
   */
  _ensureConnected() {
    if (!this._connected || !this._client) {
      throw new Error('[DBConnect] Not connected. Call reconnect() first.');
    }
  }

  /**
   * Wraps a Supabase error with operation context for easier debugging.
   * @private
   * @param {string} operation - CRUD operation name
   * @param {string} table - Table name
   * @param {Error} originalError - The Supabase error
   * @returns {Error}
   */
  _wrapError(operation, table, originalError) {
    const err = new Error(
      `[DBConnect] ${operation} on "${table}" failed: ${originalError.message}`
    );
    err.code = originalError.code;
    err.details = originalError.details;
    err.hint = originalError.hint;
    err.statusCode = originalError.code === '23505' ? 409 : 500;
    return err;
  }
}

module.exports = DBConnect;
