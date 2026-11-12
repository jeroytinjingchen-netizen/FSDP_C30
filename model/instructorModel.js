// model/instructorModel.js - instructors, their centres and weekly availability (AS-8)
const pool = require('../dbConfig');

const SELECT = `
  SELECT i.id, i.name, i.email, i.phone, i.rank_id, r.name AS rank_name,
         i.qualifications, i.is_active,
         COALESCE(
           (SELECT array_agg(ic.centre_id ORDER BY ic.centre_id)
              FROM instructor_centres ic WHERE ic.instructor_id = i.id),
           '{}'
         ) AS centre_ids
  FROM instructors i
  LEFT JOIN ranks r ON r.id = i.rank_id`;

async function list(centreId) {
  const { rows } = await pool.query(
    `${SELECT}
     WHERE ($1::uuid IS NULL OR EXISTS (
       SELECT 1 FROM instructor_centres ic WHERE ic.instructor_id = i.id AND ic.centre_id = $1))
     ORDER BY i.name`,
    [centreId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE i.id = $1`, [id]);
  return rows[0] || null;
}

// Replaces the centre links inside one transaction.
async function setCentres(client, instructorId, centreIds) {
  await client.query('DELETE FROM instructor_centres WHERE instructor_id = $1', [instructorId]);
  for (const centreId of centreIds) {
    await client.query('INSERT INTO instructor_centres (instructor_id, centre_id) VALUES ($1,$2)', [instructorId, centreId]);
  }
}

async function create({ name, email, phone, rank_id, qualifications, centre_ids }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO instructors (name, email, phone, rank_id, qualifications)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, email || null, phone || null, rank_id || null, qualifications || null]
    );
    await setCentres(client, rows[0].id, centre_ids);
    await client.query('COMMIT');
    return findById(rows[0].id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function update(id, { name, email, phone, rank_id, qualifications, centre_ids }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE instructors SET name=$2, email=$3, phone=$4, rank_id=$5, qualifications=$6 WHERE id=$1`,
      [id, name, email || null, phone || null, rank_id || null, qualifications || null]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    await setCentres(client, id, centre_ids);
    await client.query('COMMIT');
    return findById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function setActive(id, isActive) {
  const { rowCount } = await pool.query('UPDATE instructors SET is_active = $2 WHERE id = $1', [id, isActive]);
  return rowCount > 0;
}

async function listAvailability(instructorId) {
  const { rows } = await pool.query(
    `SELECT id, weekday, start_minute, end_minute FROM instructor_availability
     WHERE instructor_id = $1 ORDER BY weekday, start_minute`,
    [instructorId]
  );
  return rows;
}

// Replaces the weekly availability in one transaction.
async function replaceAvailability(instructorId, slots) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM instructor_availability WHERE instructor_id = $1', [instructorId]);
    for (const s of slots) {
      await client.query(
        'INSERT INTO instructor_availability (instructor_id, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4)',
        [instructorId, s.weekday, s.start_minute, s.end_minute]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return listAvailability(instructorId);
}

module.exports = { list, findById, create, update, setActive, listAvailability, replaceAvailability };
