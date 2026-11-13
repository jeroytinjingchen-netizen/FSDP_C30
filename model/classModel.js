// model/classModel.js - class templates, generated sessions and conflict checks (AS-11, AS-12, AS-13)
const pool = require('../dbConfig');

const TEMPLATE_SELECT = `
  SELECT ct.id, ct.term_id, t.name AS term_name, t.centre_id, c.name AS centre_name,
         ct.venue_id, v.name AS venue_name, ct.level_rank_id, r.name AS level_rank_name,
         ct.name, ct.weekday, ct.start_minute, ct.end_minute,
         COALESCE(
           (SELECT json_agg(json_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
              FROM class_template_instructors cti
              JOIN instructors i ON i.id = cti.instructor_id
             WHERE cti.template_id = ct.id), '[]') AS instructors
  FROM class_templates ct
  JOIN terms t   ON t.id = ct.term_id
  JOIN centres c ON c.id = t.centre_id
  JOIN venues v  ON v.id = ct.venue_id
  LEFT JOIN ranks r ON r.id = ct.level_rank_id`;

async function listTemplates(termId) {
  const { rows } = await pool.query(
    `${TEMPLATE_SELECT} WHERE ($1::uuid IS NULL OR ct.term_id = $1) ORDER BY ct.weekday, ct.start_minute`,
    [termId]
  );
  return rows;
}

async function findTemplate(id) {
  const { rows } = await pool.query(`${TEMPLATE_SELECT} WHERE ct.id = $1`, [id]);
  return rows[0] || null;
}

async function writeTemplateInstructors(client, templateId, instructorIds) {
  await client.query('DELETE FROM class_template_instructors WHERE template_id = $1', [templateId]);
  for (const instructorId of instructorIds) {
    await client.query(
      'INSERT INTO class_template_instructors (template_id, instructor_id) VALUES ($1,$2)',
      [templateId, instructorId]
    );
  }
}

async function createTemplate(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO class_templates (term_id, venue_id, level_rank_id, name, weekday, start_minute, end_minute)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [data.term_id, data.venue_id, data.level_rank_id || null, data.name, data.weekday, data.start_minute, data.end_minute]
    );
    await writeTemplateInstructors(client, rows[0].id, data.instructor_ids);
    await client.query('COMMIT');
    return findTemplate(rows[0].id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateTemplate(id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE class_templates SET venue_id=$2, level_rank_id=$3, name=$4, weekday=$5, start_minute=$6, end_minute=$7
       WHERE id=$1`,
      [id, data.venue_id, data.level_rank_id || null, data.name, data.weekday, data.start_minute, data.end_minute]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    await writeTemplateInstructors(client, id, data.instructor_ids);
    await client.query('COMMIT');
    return findTemplate(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function removeTemplate(id) {
  const { rowCount } = await pool.query('DELETE FROM class_templates WHERE id = $1', [id]);
  return rowCount > 0;
}

// Generates dated sessions for every matching weekday in the term. Singapore time is UTC+8.
// ON CONFLICT keeps re-running generation safe (UNIQUE template_id + starts_at).
async function generateSessions(templateId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `WITH tpl AS (
         SELECT ct.id, ct.venue_id, ct.weekday, ct.start_minute, ct.end_minute, t.start_date, t.end_date
         FROM class_templates ct JOIN terms t ON t.id = ct.term_id
         WHERE ct.id = $1
       ),
       days AS (
         SELECT d::date AS day, tpl.*
         FROM tpl, generate_series(tpl.start_date, tpl.end_date, interval '1 day') AS d
         WHERE EXTRACT(ISODOW FROM d)::int - 1 = tpl.weekday
       ),
       ins AS (
         INSERT INTO class_sessions (template_id, venue_id, starts_at, ends_at)
         SELECT $1, venue_id,
                (day + make_interval(mins => start_minute)) AT TIME ZONE 'Asia/Singapore',
                (day + make_interval(mins => end_minute))   AT TIME ZONE 'Asia/Singapore'
         FROM days
         ON CONFLICT (template_id, starts_at) DO NOTHING
         RETURNING id
       )
       SELECT COUNT(*)::int AS created FROM ins`,
      [templateId]
    );
    await client.query('COMMIT');
    return rows[0].created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const SESSION_SELECT = `
  SELECT s.id, s.template_id, ct.name AS template_name, ct.term_id, s.venue_id, v.name AS venue_name,
         t.centre_id, s.starts_at, s.ends_at, s.status, s.note,
         COALESCE(
           (SELECT json_agg(json_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
              FROM class_session_instructors csi
              JOIN instructors i ON i.id = csi.instructor_id
             WHERE csi.session_id = s.id), '[]') AS instructors
  FROM class_sessions s
  JOIN class_templates ct ON ct.id = s.template_id
  JOIN terms t            ON t.id = ct.term_id
  JOIN venues v           ON v.id = s.venue_id`;

async function listSessions({ centreId, from, to }) {
  const { rows } = await pool.query(
    `${SESSION_SELECT}
     WHERE ($1::uuid IS NULL OR t.centre_id = $1)
       AND ($2::timestamptz IS NULL OR s.starts_at >= $2)
       AND ($3::timestamptz IS NULL OR s.starts_at < $3)
     ORDER BY s.starts_at`,
    [centreId, from || null, to || null]
  );
  return rows;
}

async function findSession(id) {
  const { rows } = await pool.query(`${SESSION_SELECT} WHERE s.id = $1`, [id]);
  return rows[0] || null;
}

async function updateSessionFields(id, { venue_id, status, note }) {
  await pool.query(
    'UPDATE class_sessions SET venue_id = $2, status = COALESCE($3, status), note = COALESCE($4, note) WHERE id = $1',
    [id, venue_id, status, note]
  );
}

async function setSessionInstructors(sessionId, instructorIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM class_session_instructors WHERE session_id = $1', [sessionId]);
    for (const instructorId of instructorIds) {
      await client.query(
        'INSERT INTO class_session_instructors (session_id, instructor_id) VALUES ($1,$2)',
        [sessionId, instructorId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return findSession(sessionId);
}

// Conflicts for one session: an instructor or venue already booked in an overlapping, non-cancelled session.
async function findConflicts(sessionId, instructorIds, venueId, startsAt, endsAt) {
  const { rows } = await pool.query(
    `SELECT 'INSTRUCTOR' AS kind, i.name AS subject, s.id AS other_session_id, s.starts_at, s.ends_at
       FROM class_session_instructors csi
       JOIN class_sessions s ON s.id = csi.session_id
       JOIN instructors i ON i.id = csi.instructor_id
      WHERE csi.instructor_id = ANY($2::uuid[])
        AND s.id <> $1 AND s.status <> 'CANCELLED'
        AND s.starts_at < $4 AND s.ends_at > $3
     UNION ALL
     SELECT 'VENUE', v.name, s.id, s.starts_at, s.ends_at
       FROM class_sessions s
       JOIN venues v ON v.id = s.venue_id
      WHERE s.venue_id = $5
        AND s.id <> $1 AND s.status <> 'CANCELLED'
        AND s.starts_at < $4 AND s.ends_at > $3`,
    [sessionId, instructorIds, startsAt, endsAt, venueId]
  );
  return rows;
}

// One query for every session in the centre filter, instead of one findConflicts call per session.
// Matches findConflicts: other sessions must be non-cancelled, overlap in time, and share an instructor or venue.
async function findAllConflicts({ centreId }) {
  const { rows } = await pool.query(
    `WITH sess AS (
       SELECT s.id, s.venue_id, s.starts_at, s.ends_at, ct.name AS template_name
         FROM class_sessions s
         JOIN class_templates ct ON ct.id = s.template_id
         JOIN terms t            ON t.id = ct.term_id
        WHERE ($1::uuid IS NULL OR t.centre_id = $1)
     )
     SELECT 'INSTRUCTOR' AS kind, i.name AS subject, a.id AS session_id, a.template_name,
            b.id AS other_session_id, b.starts_at, b.ends_at
       FROM sess a
       JOIN class_session_instructors ca ON ca.session_id = a.id
       JOIN class_session_instructors cb ON cb.instructor_id = ca.instructor_id
       JOIN class_sessions b             ON b.id = cb.session_id
       JOIN instructors i                ON i.id = ca.instructor_id
      WHERE b.id <> a.id AND b.status <> 'CANCELLED'
        AND b.starts_at < a.ends_at AND b.ends_at > a.starts_at
     UNION ALL
     SELECT 'VENUE', v.name, a.id, a.template_name, b.id, b.starts_at, b.ends_at
       FROM sess a
       JOIN class_sessions b ON b.venue_id = a.venue_id
       JOIN venues v         ON v.id = a.venue_id
      WHERE b.id <> a.id AND b.status <> 'CANCELLED'
        AND b.starts_at < a.ends_at AND b.ends_at > a.starts_at`,
    [centreId]
  );
  return rows;
}

module.exports = {
  listTemplates,
  findAllConflicts,
  findTemplate,
  createTemplate,
  updateTemplate,
  removeTemplate,
  generateSessions,
  listSessions,
  findSession,
  setSessionInstructors,
  updateSessionFields,
  findConflicts,
};
