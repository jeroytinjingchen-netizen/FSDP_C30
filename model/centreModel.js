// model/centreModel.js - data access for centres
const pool = require('../dbConfig');

const SELECT = `
  SELECT c.id, c.name, c.address, c.email, c.phone, c.is_active, c.created_at, c.updated_at,
         (SELECT count(*)::int FROM students s WHERE s.centre_id = c.id) AS student_count,
         (SELECT count(*)::int FROM students s WHERE s.centre_id = c.id AND s.is_active) AS active_student_count
  FROM centres c`;

async function list(includeArchived) {
  const where = includeArchived ? '' : 'WHERE c.is_active';
  const { rows } = await pool.query(`${SELECT} ${where} ORDER BY c.is_active DESC, c.name`);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

async function create({ name, address, email, phone }) {
  const { rows } = await pool.query(
    'INSERT INTO centres (name, address, email, phone) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, address, email || null, phone || null]
  );
  return findById(rows[0].id);
}

async function update(id, { name, address, email, phone }) {
  const { rowCount } = await pool.query(
    'UPDATE centres SET name=$2, address=$3, email=$4, phone=$5, updated_at=now() WHERE id=$1',
    [id, name, address, email || null, phone || null]
  );
  return rowCount ? findById(id) : null;
}

async function setActive(id, isActive) {
  const { rowCount } = await pool.query(
    'UPDATE centres SET is_active=$2, updated_at=now() WHERE id=$1',
    [id, isActive]
  );
  return rowCount ? findById(id) : null;
}

// Returns the student count, or null when the centre does not exist.
async function countStudents(id) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM students WHERE centre_id = $1) AS n
     WHERE EXISTS (SELECT 1 FROM centres WHERE id = $1)`,
    [id]
  );
  return rows.length ? rows[0].n : null;
}

async function remove(id) {
  await pool.query('DELETE FROM centres WHERE id = $1', [id]);
}

async function isActive(id) {
  const { rows } = await pool.query('SELECT is_active FROM centres WHERE id = $1', [id]);
  return rows.length ? rows[0].is_active : null;
}

module.exports = { list, findById, create, update, setActive, countStudents, remove, isActive };
