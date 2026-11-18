// model/gradingModel.js - grading sessions and results (AS-10, AS-11).
//
// Rules from the backlog:
//  - Gradings are mass events held only at HQ, so every session belongs to the HQ centre (centres.is_hq).
//  - A result is one row in grading_candidates: student, rank graded for, outcome (GRADED / NOT_GRADED)
//    and the grading instructor. The student's centre is read from the student record.
//  - Saving a result NEVER changes the student's rank. The admin does that on purpose (AS-8).
//
// pool.query(sql, params) runs one statement; $1, $2 ... are placeholders (prevents SQL injection).
const pool = require('../dbConfig');

// Returns the HQ centre id, or null when no centre is flagged as HQ.
async function findHqCentreId() {
  const { rows } = await pool.query('SELECT id FROM centres WHERE is_hq LIMIT 1');
  return rows[0] ? rows[0].id : null;
}

// Shared SELECT for a session. The subqueries count the results by outcome.
const SESSION_SELECT = `
  SELECT g.id, g.title, g.starts_at, g.ends_at, g.status, g.notes, g.centre_id, c.name AS centre_name,
         (SELECT count(*)::int FROM grading_candidates gc WHERE gc.grading_session_id = g.id) AS student_count,
         (SELECT count(*)::int FROM grading_candidates gc
           WHERE gc.grading_session_id = g.id AND gc.outcome = 'GRADED') AS graded_count,
         (SELECT count(*)::int FROM grading_candidates gc
           WHERE gc.grading_session_id = g.id AND gc.outcome = 'NOT_GRADED') AS not_graded_count
  FROM grading_sessions g
  JOIN centres c ON c.id = g.centre_id`;

// Lists sessions newest first (AS-11). Each filter is switched off when its value is null.
//  - centreId: the session has a result for a student of that centre
//  - rankId:   the session has a result graded for that rank
//  - start/end: session date range (start inclusive, end exclusive)
async function listSessions({ centreId, rankId, start, end }) {
  const { rows } = await pool.query(
    `${SESSION_SELECT}
     WHERE ($1::uuid IS NULL OR EXISTS (
             SELECT 1 FROM grading_candidates gc JOIN students s ON s.id = gc.student_id
              WHERE gc.grading_session_id = g.id AND s.centre_id = $1))
       AND ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM grading_candidates gc
              WHERE gc.grading_session_id = g.id AND gc.graded_for_rank_id = $2))
       AND ($3::timestamptz IS NULL OR g.starts_at >= $3)
       AND ($4::timestamptz IS NULL OR g.starts_at <  $4)
     ORDER BY g.starts_at DESC`,
    [centreId, rankId, start, end]
  );
  return rows;
}

// Returns one session, or null when the id does not exist.
async function findSession(id) {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE g.id = $1`, [id]);
  return rows[0] || null;
}

// Creates a session at the HQ centre. type 'MASS' because gradings are mass events.
async function createSession({ centreId, title, startsAt, endsAt, notes }) {
  const { rows } = await pool.query(
    `INSERT INTO grading_sessions (centre_id, type, title, starts_at, ends_at, notes)
     VALUES ($1, 'MASS', $2, $3, $4, $5) RETURNING id`,
    [centreId, title || null, startsAt, endsAt, notes || null]
  );
  return findSession(rows[0].id);
}

// Edits the date, title and notes of a session.
async function updateSession(id, { title, startsAt, endsAt, notes }) {
  const { rowCount } = await pool.query(
    `UPDATE grading_sessions SET title=$2, starts_at=$3, ends_at=$4, notes=$5, updated_at=now() WHERE id=$1`,
    [id, title || null, startsAt, endsAt, notes || null]
  );
  return rowCount ? findSession(id) : null;
}

// Deletes a session only when it has no results. Returns 'NOT_FOUND', 'HAS_RESULTS' or 'DELETED'.
async function removeSession(id) {
  const found = await pool.query(
    `SELECT (SELECT count(*)::int FROM grading_candidates WHERE grading_session_id = $1) AS n
      WHERE EXISTS (SELECT 1 FROM grading_sessions WHERE id = $1)`,
    [id]
  );
  if (!found.rows.length) return 'NOT_FOUND';
  if (found.rows[0].n > 0) return 'HAS_RESULTS';
  await pool.query('DELETE FROM grading_sessions WHERE id = $1', [id]);
  return 'DELETED';
}

// Shared SELECT for a result row, with the student's centre and current rank.
const RESULT_SELECT = `
  SELECT gc.id, gc.grading_session_id, gc.student_id, s.first_name, s.last_name,
         s.centre_id, c.name AS centre_name,
         s.current_rank_id, cr.name AS current_rank_name,
         gc.graded_for_rank_id, gr.name AS graded_for_rank,
         gc.instructor_id, i.name AS instructor_name,
         gc.outcome, gc.remarks, gc.result_recorded_at
  FROM grading_candidates gc
  JOIN students s ON s.id = gc.student_id
  JOIN centres c ON c.id = s.centre_id
  JOIN ranks cr ON cr.id = s.current_rank_id
  LEFT JOIN ranks gr ON gr.id = gc.graded_for_rank_id
  LEFT JOIN instructors i ON i.id = gc.instructor_id`;

// Results of one session, optionally filtered by student centre and rank graded for.
async function listResults(sessionId, { centreId, rankId }) {
  const { rows } = await pool.query(
    `${RESULT_SELECT}
     WHERE gc.grading_session_id = $1
       AND ($2::uuid IS NULL OR s.centre_id = $2)
       AND ($3::uuid IS NULL OR gc.graded_for_rank_id = $3)
     ORDER BY s.last_name, s.first_name`,
    [sessionId, centreId, rankId]
  );
  return rows;
}

async function findResult(id) {
  const { rows } = await pool.query(`${RESULT_SELECT} WHERE gc.id = $1`, [id]);
  return rows[0] || null;
}

// Adds one result. from_rank_id is the student's rank at the time, copied from the student row.
// INSERT ... SELECT inserts nothing when the student id does not exist, so null is returned.
async function addResult(sessionId, { studentId, gradedForRankId, instructorId, outcome, remarks }) {
  const { rows } = await pool.query(
    `INSERT INTO grading_candidates
       (grading_session_id, student_id, from_rank_id, graded_for_rank_id, instructor_id, outcome, remarks, result_recorded_at)
     SELECT $1, s.id, s.current_rank_id, $3, $4, $5, $6, now() FROM students s WHERE s.id = $2
     RETURNING id`,
    [sessionId, studentId, gradedForRankId, instructorId, outcome, remarks || null]
  );
  return rows[0] ? findResult(rows[0].id) : null;
}

// Edits a result. The student cannot be changed; remove the result and add another instead.
async function updateResult(id, { gradedForRankId, instructorId, outcome, remarks }) {
  const { rowCount } = await pool.query(
    `UPDATE grading_candidates
        SET graded_for_rank_id=$2, instructor_id=$3, outcome=$4, remarks=$5, result_recorded_at=now()
      WHERE id=$1`,
    [id, gradedForRankId, instructorId, outcome, remarks || null]
  );
  return rowCount ? findResult(id) : null;
}

// Deletes a result. Fails with Postgres error 23503 when a rank change already points at it.
async function removeResult(id) {
  const { rowCount } = await pool.query('DELETE FROM grading_candidates WHERE id = $1', [id]);
  return rowCount > 0;
}

// Bulk upload (AS-10). `records` come from the parsed CSV:
//   { line, email, rank, outcome, instructor, remarks }
// Names are matched case-insensitively. Every row is checked first; if ANY row has a problem nothing
// is saved and all problems are returned, so the admin can fix the file and upload it again.
// Returns { created } on success or { errors: [{ line, error }] }.
async function bulkAddResults(sessionId, records) {
  const [students, ranks, instructors, existing] = await Promise.all([
    pool.query('SELECT id, lower(email) AS email FROM students'),
    pool.query('SELECT id, lower(name) AS name FROM ranks'),
    pool.query('SELECT id, lower(name) AS name FROM instructors'),
    pool.query('SELECT student_id FROM grading_candidates WHERE grading_session_id = $1', [sessionId]),
  ]);
  // Map objects give fast lookups by key.
  const studentByEmail = new Map(students.rows.map((r) => [r.email, r.id]));
  const rankByName = new Map(ranks.rows.map((r) => [r.name, r.id]));
  const instructorByName = new Map(instructors.rows.map((r) => [r.name, r.id]));
  // A Set remembers which students already have a result, including ones seen earlier in this file.
  const seen = new Set(existing.rows.map((r) => r.student_id));

  const errors = [];
  const ready = [];
  for (const rec of records) {
    const problems = [];
    const studentId = studentByEmail.get(rec.email.toLowerCase());
    const rankId = rankByName.get(rec.rank.toLowerCase());
    const instructorId = instructorByName.get(rec.instructor.toLowerCase());
    if (!studentId) problems.push(`no student with email "${rec.email}"`);
    else if (seen.has(studentId)) problems.push('student already has a result in this grading');
    if (!rankId) problems.push(`unknown rank "${rec.rank}"`);
    if (!instructorId) problems.push(`unknown instructor "${rec.instructor}"`);
    if (!['GRADED', 'NOT_GRADED'].includes(rec.outcome)) problems.push('outcome must be Graded or Not graded');
    if (problems.length) {
      errors.push({ line: rec.line, error: problems.join('; ') });
    } else {
      seen.add(studentId);
      ready.push({ studentId, rankId, instructorId, outcome: rec.outcome, remarks: rec.remarks });
    }
  }
  if (errors.length) return { errors };

  // One transaction: either every row is saved or none is.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of ready) {
      await client.query(
        `INSERT INTO grading_candidates
           (grading_session_id, student_id, from_rank_id, graded_for_rank_id, instructor_id, outcome, remarks, result_recorded_at)
         SELECT $1, s.id, s.current_rank_id, $3, $4, $5, $6, now() FROM students s WHERE s.id = $2`,
        [sessionId, r.studentId, r.rankId, r.instructorId, r.outcome, r.remarks || null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { created: ready.length };
}

module.exports = {
  findHqCentreId, listSessions, findSession, createSession, updateSession, removeSession,
  listResults, findResult, addResult, updateResult, removeResult, bulkAddResults,
};
