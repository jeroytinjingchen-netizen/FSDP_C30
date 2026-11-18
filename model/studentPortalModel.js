// model/studentPortalModel.js - SQL for the minimal student portal:
// current rank, the packages on sale, the student's own package, and attendance.
// A "model" file holds the SQL. Controllers call these functions and never write SQL themselves.

// Shared connection pool. pool.query(sql, values) runs one query and returns { rows }.
const pool = require('../dbConfig');

// Returns the student's current rank (name, colour, order, and the date it was awarded).
// JOIN ranks adds the rank row that current_rank_id points to.
async function getRank(studentId) {
  const { rows } = await pool.query(
    `SELECT r.name, r.colour, r.rank_order, s.rank_since
       FROM students s
       JOIN ranks r ON r.id = s.current_rank_id
      WHERE s.id = $1`,
    [studentId]
  );
  return rows[0] || null;
}

// Lists the packages a student can buy. Packages are a fixed list kept in the database.
async function listPackages() {
  const { rows } = await pool.query(
    `SELECT id, name, sessions_total, validity_weeks, price_cents, currency
       FROM packages
      WHERE is_active
      ORDER BY price_cents`
  );
  return rows;
}

// Finds one package that is on sale, or null.
async function findPackage(packageId) {
  const { rows } = await pool.query(
    `SELECT id, name, sessions_total, validity_weeks, price_cents, currency
       FROM packages
      WHERE id = $1 AND is_active`,
    [packageId]
  );
  return rows[0] || null;
}

// Returns the student's most recently bought package with sessions used and left.
// sessions_used counts attendance rows. A package is "active" while it has not expired
// and still has sessions left. The subquery in the SELECT list counts rows per package.
async function getCurrentPackage(studentId) {
  const { rows } = await pool.query(
    `SELECT sp.id, sp.name, sp.sessions_total, sp.purchased_at, sp.expires_at,
            u.used AS sessions_used,
            GREATEST(sp.sessions_total - u.used, 0) AS sessions_remaining,
            (sp.expires_at > now() AND u.used < sp.sessions_total) AS is_active
       FROM student_packages sp
       CROSS JOIN LATERAL (
         SELECT count(*)::int AS used FROM attendance a WHERE a.student_package_id = sp.id
       ) u
      WHERE sp.student_id = $1
      ORDER BY (sp.expires_at > now() AND u.used < sp.sessions_total) DESC, sp.purchased_at DESC
      LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

// Records one attendance for today (Singapore date), which uses up one session.
// It runs in a transaction so two quick clicks cannot use more sessions than the package has.
// Returns { attendance } on success, or { error } with one of:
//   NO_ACTIVE_PACKAGE  the student has no unexpired package with sessions left
//   ALREADY_RECORDED   an attendance was already recorded today
async function recordAttendance(studentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE locks the chosen package row until COMMIT, so concurrent requests queue up.
    const { rows } = await client.query(
      `SELECT sp.id, sp.sessions_total
         FROM student_packages sp
        WHERE sp.student_id = $1 AND sp.expires_at > now()
        ORDER BY sp.expires_at
        FOR UPDATE`,
      [studentId]
    );

    let chosen = null;
    for (const pkg of rows) {
      const used = await client.query(
        'SELECT count(*)::int AS used FROM attendance WHERE student_package_id = $1',
        [pkg.id]
      );
      if (used.rows[0].used < pkg.sessions_total) {
        chosen = pkg;
        break;
      }
    }
    if (!chosen) {
      await client.query('ROLLBACK');
      return { error: 'NO_ACTIVE_PACKAGE' };
    }

    // UNIQUE (student_id, attended_on) allows one attendance per day. ON CONFLICT DO NOTHING
    // turns a second attempt into "no row inserted" instead of an error.
    const inserted = await client.query(
      `INSERT INTO attendance (student_id, student_package_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id, attended_on) DO NOTHING
       RETURNING id, attended_at`,
      [studentId, chosen.id]
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return { error: 'ALREADY_RECORDED' };
    }

    await client.query('COMMIT');
    return { attendance: inserted.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getRank, listPackages, findPackage, getCurrentPackage, recordAttendance };
