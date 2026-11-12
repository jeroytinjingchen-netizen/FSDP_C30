// model/gradingModel.js - grading sessions, candidates, results and promotions (AS-16, AS-19, AS-22, AS-23)
const pool = require('../dbConfig');

const SESSION_SELECT = `
  SELECT g.id, g.centre_id, c.name AS centre_name, g.venue_id, v.name AS venue_name,
         g.type, g.status, g.title, g.starts_at, g.ends_at, g.notes,
         COALESCE((SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'rank_order', r.rank_order) ORDER BY r.rank_order)
                     FROM grading_ranks_tested grt JOIN ranks r ON r.id = grt.rank_id
                    WHERE grt.grading_session_id = g.id), '[]') AS ranks_tested,
         COALESCE((SELECT json_agg(json_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
                     FROM grading_examiners ge JOIN instructors i ON i.id = ge.instructor_id
                    WHERE ge.grading_session_id = g.id), '[]') AS examiners,
         (SELECT COUNT(*)::int FROM grading_candidates gc WHERE gc.grading_session_id = g.id) AS candidate_count
  FROM grading_sessions g
  JOIN centres c ON c.id = g.centre_id
  JOIN venues v  ON v.id = g.venue_id`;

async function listSessions(centreId) {
  const { rows } = await pool.query(
    `${SESSION_SELECT} WHERE ($1::uuid IS NULL OR g.centre_id = $1) ORDER BY g.starts_at DESC`,
    [centreId]
  );
  return rows;
}

async function findSession(id) {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE g.id = $1`, [id]);
  return rows[0] || null;
}

async function writeChildren(client, id, rankIds, examinerIds) {
  await client.query('DELETE FROM grading_ranks_tested WHERE grading_session_id = $1', [id]);
  for (const rankId of rankIds) {
    await client.query('INSERT INTO grading_ranks_tested (grading_session_id, rank_id) VALUES ($1,$2)', [id, rankId]);
  }
  await client.query('DELETE FROM grading_examiners WHERE grading_session_id = $1', [id]);
  for (const instructorId of examinerIds) {
    await client.query('INSERT INTO grading_examiners (grading_session_id, instructor_id) VALUES ($1,$2)', [id, instructorId]);
  }
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function createSession(data) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO grading_sessions (centre_id, venue_id, type, title, starts_at, ends_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [data.centre_id, data.venue_id, data.type, data.title || null, data.starts_at, data.ends_at, data.notes || null]
    );
    await writeChildren(client, rows[0].id, data.rank_ids, data.examiner_ids);
    return rows[0].id;
  }).then(findSession);
}

async function updateSession(id, data) {
  const updated = await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE grading_sessions SET centre_id=$2, venue_id=$3, type=$4, title=$5, starts_at=$6, ends_at=$7, notes=$8
       WHERE id=$1`,
      [id, data.centre_id, data.venue_id, data.type, data.title || null, data.starts_at, data.ends_at, data.notes || null]
    );
    if (!rowCount) return false;
    await writeChildren(client, id, data.rank_ids, data.examiner_ids);
    return true;
  });
  return updated ? findSession(id) : null;
}

async function removeSession(id) {
  const { rowCount } = await pool.query('DELETE FROM grading_sessions WHERE id = $1', [id]);
  return rowCount > 0;
}

// Candidates with their current rank and whether the rank is tested in this session.
async function listCandidates(sessionId) {
  const { rows } = await pool.query(
    `SELECT gc.id, gc.student_id, s.first_name, s.last_name, s.email, s.is_active, s.rank_since,
            gc.from_rank_id, fr.name AS from_rank_name, fr.rank_order AS from_rank_order,
            gc.outcome, gc.remarks, gc.result_recorded_at,
            s.current_rank_id, cr.name AS current_rank_name,
            EXISTS (SELECT 1 FROM grading_ranks_tested grt
                     WHERE grt.grading_session_id = gc.grading_session_id AND grt.rank_id = gc.from_rank_id) AS rank_is_tested
       FROM grading_candidates gc
       JOIN students s ON s.id = gc.student_id
       JOIN ranks fr  ON fr.id = gc.from_rank_id
       JOIN ranks cr  ON cr.id = s.current_rank_id
      WHERE gc.grading_session_id = $1
      ORDER BY s.last_name, s.first_name`,
    [sessionId]
  );
  return rows;
}

async function findCandidate(client, candidateId) {
  const { rows } = await client.query(
    `SELECT gc.id, gc.grading_session_id, gc.student_id, gc.from_rank_id, gc.outcome
       FROM grading_candidates gc WHERE gc.id = $1`,
    [candidateId]
  );
  return rows[0] || null;
}

async function addCandidate(sessionId, studentId) {
  const { rows } = await pool.query(
    `INSERT INTO grading_candidates (grading_session_id, student_id, from_rank_id)
     SELECT $1, s.id, s.current_rank_id FROM students s WHERE s.id = $2
     RETURNING id`,
    [sessionId, studentId]
  );
  return rows[0] ? rows[0].id : null;
}

async function removeCandidate(candidateId) {
  const { rowCount } = await pool.query(
    'DELETE FROM grading_candidates WHERE id = $1 AND outcome IS NULL',
    [candidateId]
  );
  return rowCount > 0;
}

// Records a result. A PASS promotes the student one rank up in the same transaction.
// The UNIQUE candidate_id on promotion_history makes a repeated submission a no-op.
async function recordResult(candidateId, { outcome, remarks }) {
  return withTransaction(async (client) => {
    const candidate = await findCandidate(client, candidateId);
    if (!candidate) return { status: 'NOT_FOUND' };
    if (candidate.outcome) return { status: 'ALREADY_RECORDED' };

    await client.query(
      'UPDATE grading_candidates SET outcome=$2, remarks=$3, result_recorded_at=now() WHERE id=$1',
      [candidateId, outcome, remarks || null]
    );

    let promotion = null;
    if (outcome === 'PASS') {
      const { rows } = await client.query(
        `SELECT s.id AS student_id, s.current_rank_id, r.rank_order
           FROM students s JOIN ranks r ON r.id = s.current_rank_id
          WHERE s.id = $1 FOR UPDATE OF s`,
        [candidate.student_id]
      );
      const student = rows[0];
      if (student && student.current_rank_id === candidate.from_rank_id) {
        const next = await client.query(
          'SELECT id, name FROM ranks WHERE rank_order > $1 ORDER BY rank_order LIMIT 1',
          [student.rank_order]
        );
        if (next.rows[0]) {
          await client.query('UPDATE students SET current_rank_id=$2, rank_since=now() WHERE id=$1', [
            student.student_id,
            next.rows[0].id,
          ]);
          const ins = await client.query(
            `INSERT INTO promotion_history (student_id, candidate_id, from_rank_id, to_rank_id)
             VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id) DO NOTHING RETURNING id`,
            [student.student_id, candidateId, candidate.from_rank_id, next.rows[0].id]
          );
          promotion = ins.rows[0] ? { to_rank_id: next.rows[0].id, to_rank_name: next.rows[0].name } : null;
        }
      }
    }
    return { status: 'RECORDED', promotion };
  });
}

// Promotion history for a student (AS-23).
async function listPromotions(studentId) {
  const { rows } = await pool.query(
    `SELECT ph.id, ph.promoted_at, fr.name AS from_rank, tr.name AS to_rank
       FROM promotion_history ph
       JOIN ranks fr ON fr.id = ph.from_rank_id
       JOIN ranks tr ON tr.id = ph.to_rank_id
      WHERE ph.student_id = $1 ORDER BY ph.promoted_at DESC`,
    [studentId]
  );
  return rows;
}

// One promotion with the student, centre and rank names needed for a certificate (AS-26).
async function findPromotionCertificate(studentId, promotionId) {
  const { rows } = await pool.query(
    `SELECT ph.id, ph.promoted_at, fr.name AS from_rank, tr.name AS to_rank,
            s.first_name, s.last_name, c.name AS centre_name
       FROM promotion_history ph
       JOIN ranks fr ON fr.id = ph.from_rank_id
       JOIN ranks tr ON tr.id = ph.to_rank_id
       JOIN students s ON s.id = ph.student_id
       JOIN centres c ON c.id = s.centre_id
      WHERE ph.student_id = $1 AND ph.id = $2`,
    [studentId, promotionId]
  );
  return rows[0] || null;
}

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

module.exports = {
  listSessions,
  findSession,
  createSession,
  updateSession,
  removeSession,
  listCandidates,
  addCandidate,
  removeCandidate,
  recordResult,
  listPromotions,
  findPromotionCertificate,
  getSetting,
};
