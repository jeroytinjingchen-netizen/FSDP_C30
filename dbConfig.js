// dbConfig.js - shared pg pool (cached on globalThis so Next.js dev reloads reuse it)
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const isSupabase = /supabase\.(co|com)/.test(connectionString || '');

if (!globalThis.__pgPool) {
  globalThis.__pgPool = new Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
}

module.exports = globalThis.__pgPool;
