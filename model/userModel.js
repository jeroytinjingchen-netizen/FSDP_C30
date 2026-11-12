// model/userModel.js - data access for users and student profiles
const pool = require('../dbConfig');

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function findAuthById(id) {
  const { rows } = await pool.query('SELECT role, is_active FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function touchLastLogin(id) {
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

async function findStudentProfile(userId) {
  const { rows } = await pool.query(
    `SELECT id, centre_id, current_rank_id, first_name, last_name, phone, guardian_name, guardian_phone
     FROM students WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, findAuthById, touchLastLogin, findStudentProfile };
