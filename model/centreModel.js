// model/centreModel.js - data access for centres (AS-3).
//
// A centre is the actual training venue, so it only keeps a name and a location.
// Its weekly schedule is NOT stored on the centre: it is built from the centre's classes (AS-4).
//
// `pool` is a pg connection pool. pool.query(sql, params) runs one SQL statement;
// $1, $2 ... are placeholders filled from the params array (prevents SQL injection).
const pool = require('../dbConfig');

// Shared SELECT text. Each function below adds its own WHERE / ORDER BY.
//  - count(*)::int            counts rows and casts the bigint result to a plain integer.
//  - json_agg(json_build_object(...) ORDER BY ...) builds a JSON array of the centre's classes,
//    which becomes the "schedule". COALESCE(..., '[]') returns an empty list when there are none.
const SELECT = `
  SELECT c.id, c.name, c.address, c.email, c.phone, c.is_hq, c.is_active, c.created_at, c.updated_at,
         (SELECT count(*)::int FROM students s WHERE s.centre_id = c.id) AS student_count,
         (SELECT count(*)::int FROM students s WHERE s.centre_id = c.id AND s.is_active) AS active_student_count,
         COALESCE((SELECT json_agg(json_build_object(
                          'id', t.id, 'name', t.name, 'weekday', t.weekday,
                          'start_minute', t.start_minute, 'end_minute', t.end_minute)
                          ORDER BY t.weekday, t.start_minute)
                     FROM class_templates t WHERE t.centre_id = c.id), '[]') AS schedule
  FROM centres c`;

// Lists centres. Archived ones are hidden unless includeArchived is true.
async function list(includeArchived) {
  const where = includeArchived ? '' : 'WHERE c.is_active';
  const { rows } = await pool.query(`${SELECT} ${where} ORDER BY c.is_active DESC, c.name`);
  return rows;
}

// Returns one centre, or null when the id does not exist.
async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

// Creates a centre. "email || null" stores NULL instead of an empty string.
async function create({ name, address, email, phone }) {
  const { rows } = await pool.query(
    'INSERT INTO centres (name, address, email, phone) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, address, email || null, phone || null]
  );
  return findById(rows[0].id);
}

// Edits a centre. rowCount is how many rows were updated (0 = id not found).
async function update(id, { name, address, email, phone }) {
  const { rowCount } = await pool.query(
    'UPDATE centres SET name=$2, address=$3, email=$4, phone=$5, updated_at=now() WHERE id=$1',
    [id, name, address, email || null, phone || null]
  );
  return rowCount ? findById(id) : null;
}

// Archives (false) or restores (true) a centre. Archived centres are hidden, not deleted.
async function setActive(id, isActive) {
  const { rowCount } = await pool.query(
    'UPDATE centres SET is_active=$2, updated_at=now() WHERE id=$1',
    [id, isActive]
  );
  return rowCount ? findById(id) : null;
}

// Returns the student count, or null when the centre does not exist.
// Used to block deleting a centre that still has students.
async function countStudents(id) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM students WHERE centre_id = $1) AS n
     WHERE EXISTS (SELECT 1 FROM centres WHERE id = $1)`,
    [id]
  );
  return rows.length ? rows[0].n : null;
}

// Hard delete. The controller checks countStudents first.
async function remove(id) {
  await pool.query('DELETE FROM centres WHERE id = $1', [id]);
}

module.exports = { list, findById, create, update, setActive, countStudents, remove };
