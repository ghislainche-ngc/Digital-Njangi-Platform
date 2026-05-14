'use strict';

const DBConnect = require('./DBConnect');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[NAAS] Missing Supabase environment variables.\n' +
    'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file.'
  );
}

/**
 * Database connection — Singleton instance of DBConnect.
 *
 * Provides both the OOP CRUD interface (db.findAll, db.create, etc.)
 * and the raw Supabase client (db.getClient()) for advanced queries.
 *
 * Usage:
 *   const { db, supabase } = require('../config/supabase');
 *   // OOP way (preferred):
 *   const users = await db.findAll('users', { status: 'active' });
 *   // Legacy way (backward-compatible):
 *   const { data } = await supabase.from('users').select('*');
 */
const db = DBConnect.getInstance(supabaseUrl, supabaseServiceKey);

// Backward compatibility — existing code imports { supabase }
const supabase = db.getClient();

module.exports = { db, supabase, DBConnect };
