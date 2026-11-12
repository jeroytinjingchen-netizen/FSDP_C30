// model/termModel.js - data access for terms (AS-10)
const pool = require('../dbConfig');

const SELECT = `
  SELECT t.id, t.centre_id, c.name AS centre_name, t.name, t.start_date, t.end_date, t.created_at
  FROM terms t
  JOIN centres c ON c.id = t.centre_id`;

async function list(centreId) {
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::uuid IS NULL OR t.centre_id = $1)
     ORDER BY t.start_date DESC, t.name`,
    [centreId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

// Returns true when [start, end] overlaps an existing term in the same centre.
async function overlaps(centreId, startDate, endDate, excludeId = null) {
  const { rows } = await pool.query(
    `SELECT 1 FROM terms
     WHERE centre_id = $1
       AND start_date <= $3
       AND end_date >= $2
       AND ($4::uuid IS NULL OR id <> $4)
     LIMIT 1`,
    [centreId, startDate, endDate, excludeId]
  );
  return rows.length > 0;
}

async function create({ centre_id, name, start_date, end_date }) {
  const { rows } = await pool.query(
    'INSERT INTO terms (centre_id, name, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING id',
    [centre_id, name, start_date, end_date]
  );
  return findById(rows[0].id);
}

async function update(id, { name, start_date, end_date }) {
  const { rowCount } = await pool.query(
    'UPDATE terms SET name=$2, start_date=$3, end_date=$4 WHERE id=$1',
    [id, name, start_date, end_date]
  );
  return rowCount ? findById(id) : null;
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM terms WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, findById, overlaps, create, update, remove };
