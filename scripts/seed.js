// scripts/seed.js - idempotent demo data. Run: npm run seed
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../dbConfig');
const { seedSampleData } = require('./sampleData');

const ADMIN = { email: 'admin@aikidoshinjukai.com', password: 'Admin@12345' };
const STUDENT = { email: 'student@gmail.com', password: 'Student@12345' };

async function upsertUser(client, { email, password }, role) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true, updated_at = now()
     RETURNING id`,
    [email, hash, role]
  );
  return rows[0].id;
}

async function getOrCreateCentre(client, name, address) {
  const { rows } = await client.query(
    `INSERT INTO centres (name, address) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, address]
  );
  return rows[0].id;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await upsertUser(client, ADMIN, 'ADMIN');
    const studentUserId = await upsertUser(client, STUDENT, 'STUDENT');

    const centreA = await getOrCreateCentre(client, 'Shinjukai Bishan Centre', '1 Bishan Street 10, Singapore');
    await getOrCreateCentre(client, 'Shinjukai Jurong Centre', '2 Jurong East Street 21, Singapore');

    const { rows: rankRows } = await client.query(
      `INSERT INTO ranks (name, rank_order, colour) VALUES ('6th Kyu', 1, 'White')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );

    await client.query(
      `INSERT INTO students (user_id, centre_id, current_rank_id, first_name, last_name, email)
       VALUES ($1, $2, $3, 'Demo', 'Student', $4)
       ON CONFLICT (email) DO NOTHING`,
      [studentUserId, centreA, rankRows[0].id, STUDENT.email]
    );

    await seedSampleData(client);

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log('Sample data: 10 centres, 9 instructors, 26 students, 5 class templates, 9 grading sessions, invoices and payments.');
    console.log(`Admin:   ${ADMIN.email} / ${ADMIN.password}`);
    console.log(`Student: ${STUDENT.email} / ${STUDENT.password}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
