// model/adminStudentModel.js - students as managed by admins (AS-7, AS-8, AS-9, AS-11, AS-12).
//
// Rules from the backlog:
//  - Admins can edit name, phone, email, centre and rank.
//  - Rank changes ONLY through changeRank, which logs each change with a date. Nothing changes rank automatically.
//  - Payment records and grading history are read-only here.
//
// pool.query(sql, params) runs one statement; $1, $2 ... are placeholders (prevents SQL injection).
const pool = require('../dbConfig');

// Shared SELECT for list rows and the profile header. to_char formats the date as text (YYYY-MM-DD).
const SELECT = `
  SELECT s.id, s.centre_id, c.name AS centre_name, s.current_rank_id, r.name AS rank_name,
         s.first_name, s.last_name, s.email, s.phone,
         to_char(s.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
         s.guardian_name, s.guardian_phone, s.is_active, s.rank_since
  FROM students s
  JOIN centres c ON c.id = s.centre_id
  JOIN ranks r ON r.id = s.current_rank_id`;

// Lists students with optional filters. Each "$n IS NULL OR ..." line switches a filter off when empty.
//  - centreId: one centre (null = all)
//  - rankId:   one current rank
//  - search:   part of the name or email (ILIKE = case-insensitive LIKE)
async function list({ centreId, rankId, search }) {
  const term = search ? `%${search}%` : null;
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::uuid IS NULL OR s.centre_id = $1)
       AND ($2::uuid IS NULL OR s.current_rank_id = $2)
       AND ($3::text IS NULL OR (s.first_name || ' ' || s.last_name) ILIKE $3 OR s.email ILIKE $3)
     ORDER BY s.last_name, s.first_name`,
    [centreId, rankId, term]
  );
  return rows;
}

// Returns one student row, or null when the id does not exist.
async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE s.id = $1`, [id]);
  return rows[0] || null;
}

// Adds a student with a starting rank. Duplicate emails fail with Postgres error 23505 (UNIQUE on email).
async function create(d) {
  const { rows } = await pool.query(
    `INSERT INTO students (centre_id, current_rank_id, first_name, last_name, email, phone,
                           date_of_birth, guardian_name, guardian_phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [d.centre_id, d.current_rank_id, d.first_name, d.last_name, d.email, d.phone || null,
     d.date_of_birth || null, d.guardian_name || null, d.guardian_phone || null]
  );
  return findById(rows[0].id);
}

// Edits contact details and centre. The rank column is deliberately not touched here.
async function update(id, d) {
  const { rowCount } = await pool.query(
    `UPDATE students SET
       centre_id = $2, first_name = $3, last_name = $4, email = $5, phone = $6,
       date_of_birth = $7, guardian_name = $8, guardian_phone = $9, updated_at = now()
     WHERE id = $1`,
    [id, d.centre_id, d.first_name, d.last_name, d.email, d.phone || null,
     d.date_of_birth || null, d.guardian_name || null, d.guardian_phone || null]
  );
  return rowCount > 0 ? findById(id) : null;
}

// Marks a student active or inactive. Returns true if the student exists.
async function setActive(id, isActive) {
  const { rowCount } = await pool.query(
    'UPDATE students SET is_active = $2, updated_at = now() WHERE id = $1',
    [id, isActive]
  );
  return rowCount > 0;
}

// Manual rank update (AS-8). Runs in one transaction so the student row and the history row stay in step.
//  - rankId:     the new rank
//  - changedOn:  optional date/time of the change (defaults to now)
//  - adminId:    the admin making the change, saved for the record
//  - candidateId optional link to the grading result that led to it (AS-10 -> AS-8)
// Returns { status: 'NOT_FOUND' | 'SAME_RANK' | 'UPDATED', student }.
async function changeRank(id, { rankId, changedOn, note, candidateId }, adminId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE locks the row until COMMIT so two admins cannot change the rank at the same moment.
    const cur = await client.query('SELECT current_rank_id FROM students WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows[0]) {
      await client.query('ROLLBACK');
      return { status: 'NOT_FOUND' };
    }
    if (cur.rows[0].current_rank_id === rankId) {
      await client.query('ROLLBACK');
      return { status: 'SAME_RANK' };
    }
    // COALESCE($2, now()) uses the supplied date, or now() when none was given.
    await client.query(
      'UPDATE students SET current_rank_id = $2, rank_since = COALESCE($3::timestamptz, now()), updated_at = now() WHERE id = $1',
      [id, rankId, changedOn || null]
    );
    await client.query(
      `INSERT INTO promotion_history (student_id, candidate_id, from_rank_id, to_rank_id, promoted_at, changed_by_id, note)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6, $7)`,
      [id, candidateId || null, cur.rows[0].current_rank_id, rankId, changedOn || null, adminId || null, note || null]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { status: 'UPDATED', student: await findById(id) };
}

// Newest package with sessions used and remaining (AS-9).
// The LATERAL subquery counts this package's attendance rows. A package is active while it has
// not expired and still has sessions left.
async function currentPackage(studentId) {
  const { rows } = await pool.query(
    `SELECT sp.id, sp.name, sp.sessions_total, sp.purchased_at, sp.expires_at,
            u.used AS sessions_used,
            GREATEST(sp.sessions_total - u.used, 0) AS sessions_remaining,
            (sp.expires_at > now() AND u.used < sp.sessions_total) AS is_active
       FROM student_packages sp
       CROSS JOIN LATERAL (SELECT count(*)::int AS used FROM attendance a WHERE a.student_package_id = sp.id) u
      WHERE sp.student_id = $1
      ORDER BY (sp.expires_at > now() AND u.used < sp.sessions_total) DESC, sp.purchased_at DESC
      LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

// Every rank change with its date, newest first (AS-8).
async function rankHistory(studentId) {
  const { rows } = await pool.query(
    `SELECT ph.id, ph.promoted_at, fr.name AS from_rank, tr.name AS to_rank, ph.note
       FROM promotion_history ph
       JOIN ranks fr ON fr.id = ph.from_rank_id
       JOIN ranks tr ON tr.id = ph.to_rank_id
      WHERE ph.student_id = $1
      ORDER BY ph.promoted_at DESC`,
    [studentId]
  );
  return rows;
}

// Payment history for the profile (AS-12). Read-only.
async function paymentHistory(studentId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.amount_cents, p.paid_at, p.channel, p.reference, p.status,
            COALESCE(sp.name, pk.name) AS package_name
       FROM payments p
       LEFT JOIN student_packages sp ON sp.payment_id = p.id
       LEFT JOIN packages pk ON pk.id = sp.package_id
      WHERE p.student_id = $1
      ORDER BY p.paid_at DESC`,
    [studentId]
  );
  return rows;
}

// Grading history for the profile (AS-11). Read-only.
async function gradingHistory(studentId) {
  const { rows } = await pool.query(
    `SELECT gc.id, g.id AS grading_id, g.starts_at, g.title, gc.outcome,
            gr.name AS graded_for_rank, i.name AS instructor_name
       FROM grading_candidates gc
       JOIN grading_sessions g ON g.id = gc.grading_session_id
       LEFT JOIN ranks gr ON gr.id = gc.graded_for_rank_id
       LEFT JOIN instructors i ON i.id = gc.instructor_id
      WHERE gc.student_id = $1
      ORDER BY g.starts_at DESC`,
    [studentId]
  );
  return rows;
}

module.exports = {
  list, findById, create, update, setActive, changeRank,
  currentPackage, rankHistory, paymentHistory, gradingHistory,
};
