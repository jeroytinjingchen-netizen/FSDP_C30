// model/studentPortalModel.js - read-only student records (belt and timetable).
const pool = require('../dbConfig');

async function getBelt(studentId) {
  const { rows } = await pool.query(
    `SELECT r.name, r.colour, r.rank_order, s.rank_since
     FROM students s
     JOIN ranks r ON r.id = s.current_rank_id
     WHERE s.id = $1`,
    [studentId]
  );
  return rows[0] || null;
}

async function updateContact(studentId, { phone, guardian_name, guardian_phone }) {
  const { rows } = await pool.query(
    `UPDATE students
        SET phone = $2, guardian_name = $3, guardian_phone = $4, updated_at = now()
      WHERE id = $1
      RETURNING phone, guardian_name, guardian_phone`,
    [studentId, phone || null, guardian_name || null, guardian_phone || null]
  );
  return rows[0] || null;
}

async function listUpcomingSessions(centreId, days = 14) {
  const { rows } = await pool.query(
    `SELECT cs.id, cs.starts_at, cs.ends_at, cs.status, cs.note,
            ct.name AS class_name, v.name AS venue_name
     FROM class_sessions cs
     JOIN class_templates ct ON ct.id = cs.template_id
     JOIN venues v ON v.id = cs.venue_id
     WHERE v.centre_id = $1
       AND cs.starts_at >= now()
       AND cs.starts_at < now() + make_interval(days => $2::int)
       AND cs.status <> 'CANCELLED'
     ORDER BY cs.starts_at
     LIMIT 100`,
    [centreId, days]
  );
  return rows;
}

module.exports = { getBelt, updateContact, listUpcomingSessions };
