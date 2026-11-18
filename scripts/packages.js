// scripts/packages.js - inserts or updates the available student packages.
// Run with: node scripts/packages.js
require('dotenv').config();
const pool = require('../dbConfig');

const packages = [
  {
    id: "PKG-001",
    name: "Trial Class",
    sessions: 1,
    validityWeeks: 2,
    price: 25.0,
    currency: "SGD",
    description: "Single session for first-time students.",
    active: true,
  },
  {
    id: "PKG-002",
    name: "5-Session Pack",
    sessions: 5,
    validityWeeks: 6,
    price: 90.0,
    currency: "SGD",
    description: "5 sessions, valid for 6 weeks.",
    active: true,
  },
  {
    id: "PKG-003",
    name: "10-Session Pack",
    sessions: 10,
    validityWeeks: 11,
    price: 160.0,
    currency: "SGD",
    description: "10 sessions, valid for 11 weeks.",
    active: true,
  },
  {
    id: "PKG-004",
    name: "20-Session Pack",
    sessions: 20,
    validityWeeks: 22,
    price: 300.0,
    currency: "SGD",
    description: "20 sessions, valid for 22 weeks.",
    active: true,
  },
  {
    id: "PKG-005",
    name: "40-Session Pack",
    sessions: 40,
    validityWeeks: 44,
    price: 560.0,
    currency: "SGD",
    description: "40 sessions, valid for 44 weeks.",
    active: true,
  },
  {
    id: "PKG-006",
    name: "Junior 10-Session Pack",
    sessions: 10,
    validityWeeks: 11,
    price: 130.0,
    currency: "SGD",
    description: "10 sessions for junior students, valid for 11 weeks.",
    active: true,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const pkg of packages) {
      // PostgreSQL parameters ($1, $2, ...) keep package values separate from the SQL command.
      // Prices are stored as cents to avoid floating-point rounding problems with money.
      await client.query(
        `INSERT INTO packages (name, sessions_total, validity_weeks, price_cents, currency, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name) DO UPDATE SET
           sessions_total = EXCLUDED.sessions_total,
           validity_weeks = EXCLUDED.validity_weeks,
           price_cents = EXCLUDED.price_cents,
           currency = EXCLUDED.currency,
           is_active = EXCLUDED.is_active`,
        [pkg.name, pkg.sessions, pkg.validityWeeks, Math.round(pkg.price * 100), pkg.currency, pkg.active]
      );
    }

    await client.query('COMMIT');
    console.log(`Saved ${packages.length} packages.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Package import failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

module.exports = packages;
