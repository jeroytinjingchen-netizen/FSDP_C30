// model/paymentModel.js - read-only payment queries for admins (AS-12, AS-13)
// A "model" file holds the SQL. Controllers call these functions and never write SQL themselves.

// Shared connection pool. pool.query(sql, values) runs one query and returns { rows }.
const pool = require('../dbConfig');

// Escapes % and _ so a search term is matched literally inside an ILIKE pattern.
// ILIKE is Postgres' case-insensitive LIKE. The backslash is the default escape character.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

// Builds the WHERE clause and the parameter list shared by the list and the CSV export.
// Using $1, $2, ... placeholders (parameterised queries) stops SQL injection.
function buildFilter(filters) {
  const where = [`p.status IN ('COMPLETED', 'FAILED')`]; // legacy PENDING rows are not shown
  const values = [];

  // Adds a value to the list and returns its placeholder, for example "$3".
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  // Centre filter: payments of students who belong to the chosen centre.
  if (filters.centreId) where.push(`s.centre_id = ${add(filters.centreId)}`);

  // Payment date range. "to" is an exclusive upper bound (start of the day after the end date).
  if (filters.paymentFrom) where.push(`p.paid_at >= ${add(filters.paymentFrom)}`);
  if (filters.paymentTo) where.push(`p.paid_at < ${add(filters.paymentTo)}`);

  // Status is shown to the admin as Successful / Failed. The database stores COMPLETED / FAILED.
  if (filters.status === 'SUCCESSFUL') where.push(`p.status = 'COMPLETED'`);
  if (filters.status === 'FAILED') where.push(`p.status = 'FAILED'`);

  // Reference number or student name search (partial, case-insensitive).
  // The same placeholder is reused so the term is only added once.
  if (filters.search) {
    const term = add(`%${escapeLike(filters.search)}%`);
    where.push(`(p.reference ILIKE ${term} OR (s.first_name || ' ' || s.last_name) ILIKE ${term})`);
  }

  return { whereSql: where.join(' AND '), values };
}

// Lists payments for the admin, newest first. Read-only: there is no create, update or delete.
// LEFT JOIN keeps old payments that have no package. Every payment has a student.
async function list(filters) {
  const { whereSql, values } = buildFilter(filters);
  const { rows } = await pool.query(
    `SELECT p.id,
            p.student_id,
            s.first_name, s.last_name,
            c.id   AS centre_id,
            c.name AS centre_name,
            COALESCE(sp.name, pk.name) AS package_name,
            p.amount_cents,
            p.paid_at,
            p.channel AS payment_method,
            p.reference,
            CASE p.status WHEN 'COMPLETED' THEN 'SUCCESSFUL' ELSE 'FAILED' END AS status,
            p.notes
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN centres  c ON c.id = s.centre_id
       LEFT JOIN student_packages sp ON sp.payment_id = p.id
       LEFT JOIN packages pk ON pk.id = sp.package_id
      WHERE ${whereSql}
      ORDER BY p.paid_at DESC, p.id`,
    values
  );
  return rows;
}

module.exports = { list };
