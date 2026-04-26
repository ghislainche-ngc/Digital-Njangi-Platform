'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[NAAS] Missing Supabase environment variables.\n' +
    'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file.'
  );
}

/**
 * Service-role client — bypasses RLS.
 * Use ONLY in trusted server-side code, never expose to frontend.
 */
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };
