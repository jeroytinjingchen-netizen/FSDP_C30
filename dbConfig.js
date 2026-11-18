// dbConfig.js - shared pg pool (cached on globalThis so Next.js dev reloads reuse it).
// A Pool keeps a few database connections open and lends them to queries, which is faster than reconnecting.
const { Pool } = require('pg');

// DATABASE_URL comes from the .env file.
const connectionString = process.env.DATABASE_URL;
// Supabase needs an encrypted (SSL) connection. The regex test is true for supabase.co or supabase.com URLs.
const isSupabase = /supabase\.(co|com)/.test(connectionString || '');

// Only create the pool once, so repeated imports share the same connections.
if (!globalThis.__pgPool) {
  globalThis.__pgPool = new Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
}

module.exports = globalThis.__pgPool;
