// model/classModel.js - data access for classes (AS-4) and instructor postings (AS-6).
//
// A class belongs to one centre and repeats weekly on one day and time.
// It has at most one instructor (class_templates.instructor_id).
// The table is still called class_templates in the database; the API calls these "classes".
//
// `pool` is a pg connection pool. pool.query(sql, params) runs one SQL statement.
// $1, $2 ... in the SQL text are placeholders for values in the params array.
// Passing values this way (a "parameterised query") stops SQL injection.
const pool = require('../dbConfig');

// Shared SELECT text. Each query below appends a WHERE / ORDER BY clause.
// LEFT JOIN keeps classes that have no instructor yet (instructor columns become NULL).
const SELECT = `
  SELECT t.id, t.name, t.centre_id, c.name AS centre_name,
         t.weekday, t.start_minute, t.end_minute,
         t.instructor_id, i.name AS instructor_name
  FROM class_templates t
  JOIN centres c ON c.id = t.centre_id
  LEFT JOIN instructors i ON i.id = t.instructor_id`;

// Lists classes. centreId = null means all centres.
// "$1::uuid IS NULL OR ..." is the standard "optional filter" pattern used across the app.
async function list(centreId) {
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::uuid IS NULL OR t.centre_id = $1)
     ORDER BY c.name, t.weekday, t.start_minute`,
    [centreId]
  );
  return rows;
}

// Returns one class, or null if the id does not exist.
async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

// Creates a class. RETURNING id gives back the new row's id so we can re-read it with its joins.
async function create({ centre_id, name, weekday, start_minute, end_minute }) {
  const { rows } = await pool.query(
    `INSERT INTO class_templates (centre_id, name, weekday, start_minute, end_minute)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [centre_id, name, weekday, start_minute, end_minute]
  );
  return findById(rows[0].id);
}

// Edits a class. The instructor is changed separately through setInstructor.
// rowCount is the number of rows the UPDATE touched; 0 means the id does not exist.
async function update(id, { centre_id, name, weekday, start_minute, end_minute }) {
  const { rowCount } = await pool.query(
    `UPDATE class_templates
        SET centre_id=$2, name=$3, weekday=$4, start_minute=$5, end_minute=$6
      WHERE id=$1`,
    [id, centre_id, name, weekday, start_minute, end_minute]
  );
  return rowCount ? findById(id) : null;
}

// Removes a class. Returns true if a row was deleted.
async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM class_templates WHERE id = $1', [id]);
  return rowCount > 0;
}

// Assigns, reassigns or removes the instructor (AS-6). Pass null to remove.
async function setInstructor(id, instructorId) {
  const { rowCount } = await pool.query(
    'UPDATE class_templates SET instructor_id = $2 WHERE id = $1',
    [id, instructorId]
  );
  return rowCount ? findById(id) : null;
}

// Classes an instructor is posted to (AS-6: "see each instructor's assigned classes").
async function listByInstructor(instructorId) {
  const { rows } = await pool.query(
    `${SELECT} WHERE t.instructor_id = $1 ORDER BY t.weekday, t.start_minute`,
    [instructorId]
  );
  return rows;
}

module.exports = { list, findById, create, update, remove, setInstructor, listByInstructor };
