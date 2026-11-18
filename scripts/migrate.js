// scripts/migrate.js - applies the SQL files in /migrations in name order. Run: npm run migrate
// Each file runs in its own transaction and is recorded in schema_migrations, so a file never runs twice.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../dbConfig');

const DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  const client = await pool.connect();
  try {
    // Bookkeeping table: one row per applied migration file.
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name        text PRIMARY KEY,
         applied_at  timestamptz NOT NULL DEFAULT now()
       )`
    );
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));

    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) {
        console.log(`skip   ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`apply  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${file} failed and was rolled back: ${err.message}`);
      }
    }
    console.log('Migrations complete.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
