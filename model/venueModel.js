// model/venueModel.js - data access for venues
const pool = require('../dbConfig');

const SELECT = `
  SELECT v.id, v.centre_id, c.name AS centre_name, v.name, v.capacity, v.is_active,
         v.created_at, v.updated_at
  FROM venues v
  JOIN centres c ON c.id = v.centre_id`;

async function list(centreId, includeArchived) {
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::uuid IS NULL OR v.centre_id = $1)
       AND ($2::boolean OR v.is_active)
     ORDER BY v.is_active DESC, c.name, v.name`,
    [centreId, includeArchived]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE v.id = $1`, [id]);
  return rows[0] || null;
}

async function create({ centre_id, name, capacity }) {
  const { rows } = await pool.query(
    'INSERT INTO venues (centre_id, name, capacity) VALUES ($1,$2,$3) RETURNING id',
    [centre_id, name, capacity]
  );
  return findById(rows[0].id);
}

async function update(id, { name, capacity }) {
  const { rowCount } = await pool.query(
    'UPDATE venues SET name=$2, capacity=$3, updated_at=now() WHERE id=$1',
    [id, name, capacity]
  );
  return rowCount ? findById(id) : null;
}

async function setActive(id, isActive) {
  const { rowCount } = await pool.query(
    'UPDATE venues SET is_active=$2, updated_at=now() WHERE id=$1',
    [id, isActive]
  );
  return rowCount ? findById(id) : null;
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM venues WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, findById, create, update, setActive, remove };
