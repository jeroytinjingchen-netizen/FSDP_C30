// model/instructorModel.js - data access for instructors (AS-5) and their postings (AS-6).
//
// Instructors are records only: they do not log in, and there is no availability editor.
// The classes an instructor is posted to come from class_templates.instructor_id.
//
// pool.query(sql, params) runs one statement; $1, $2 ... are placeholders (prevents SQL injection).
const pool = require('../dbConfig');

// Shared SELECT. json_agg(json_build_object(...)) builds a JSON array of the assigned classes;
// COALESCE(..., '[]') returns an empty array when the instructor has no classes.
const SELECT = `
  SELECT i.id, i.name, i.email, i.phone, i.rank_id, r.name AS rank_name,
         i.qualifications, i.is_active,
         COALESCE((SELECT json_agg(json_build_object(
                          'id', t.id, 'name', t.name, 'centre_id', t.centre_id, 'centre_name', c.name,
                          'weekday', t.weekday, 'start_minute', t.start_minute, 'end_minute', t.end_minute)
                          ORDER BY t.weekday, t.start_minute)
                     FROM class_templates t JOIN centres c ON c.id = t.centre_id
                    WHERE t.instructor_id = i.id), '[]') AS classes
  FROM instructors i
  LEFT JOIN ranks r ON r.id = i.rank_id`;

// Lists instructors.
//  - centreId: only instructors with a class at that centre (null = everyone).
//  - search:   matches name, email or phone (ILIKE = case-insensitive LIKE; % is a wildcard).
async function list(centreId, search) {
  const term = search ? `%${search}%` : null;
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::uuid IS NULL OR EXISTS (
             SELECT 1 FROM class_templates t WHERE t.instructor_id = i.id AND t.centre_id = $1))
       AND ($2::text IS NULL OR i.name ILIKE $2 OR i.email ILIKE $2 OR i.phone ILIKE $2)
     ORDER BY i.name`,
    [centreId, term]
  );
  return rows;
}

// Returns one instructor, or null when the id does not exist.
async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE i.id = $1`, [id]);
  return rows[0] || null;
}

// Adds an instructor. "x || null" stores NULL instead of an empty string.
async function create({ name, email, phone, rank_id, qualifications }) {
  const { rows } = await pool.query(
    `INSERT INTO instructors (name, email, phone, rank_id, qualifications)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, email || null, phone || null, rank_id || null, qualifications || null]
  );
  return findById(rows[0].id);
}

// Edits an instructor. rowCount is the number of rows changed (0 = id not found).
async function update(id, { name, email, phone, rank_id, qualifications }) {
  const { rowCount } = await pool.query(
    `UPDATE instructors
        SET name=$2, email=$3, phone=$4, rank_id=$5, qualifications=$6, updated_at=now()
      WHERE id=$1`,
    [id, name, email || null, phone || null, rank_id || null, qualifications || null]
  );
  return rowCount ? findById(id) : null;
}

// Marks an instructor active or inactive. Returns true if the instructor exists.
async function setActive(id, isActive) {
  const { rowCount } = await pool.query(
    'UPDATE instructors SET is_active = $2, updated_at = now() WHERE id = $1',
    [id, isActive]
  );
  return rowCount > 0;
}

module.exports = { list, findById, create, update, setActive };
