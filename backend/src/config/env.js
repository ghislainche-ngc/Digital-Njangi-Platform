'use strict';

/**
 * Validates all required environment variables on startup.
 * The app crashes immediately with a clear message if any are missing —
 * so developers know exactly what to add to their .env file.
 */

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[NAAS] Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
    'Copy backend/.env.example to backend/.env and fill in the values.'
  );
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRY: '24h',
};
