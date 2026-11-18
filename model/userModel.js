// model/userModel.js - data access for users and student profiles.
// A model holds the SQL. "$1" in a query is a placeholder filled from the array that follows it,
// which keeps user input out of the SQL text (this prevents SQL injection).
const pool = require('../dbConfig');

// Finds a login by email. Returns the row, or null when there is none.
async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

// Finds only the role and active flag, used by the middleware on every request.
async function findAuthById(id) {
  const { rows } = await pool.query('SELECT role, is_active FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

// Records the time of the latest login. now() is the database clock.
async function touchLastLogin(id) {
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

// Finds the student record that belongs to a user account.
async function findStudentProfile(userId) {
  const { rows } = await pool.query(
    `SELECT id, centre_id, current_rank_id, first_name, last_name, phone, guardian_name, guardian_phone
     FROM students WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, findAuthById, touchLastLogin, findStudentProfile };
