// model/dashboardModel.js - aggregate figures for the admin dashboard (AS-44)
const pool = require('../dbConfig');

async function summary(centreId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM students s
         WHERE s.is_active AND ($1::uuid IS NULL OR s.centre_id = $1)) AS students,
       (SELECT COALESCE(SUM(p.amount_cents), 0)::int
          FROM payments p
          JOIN invoices i ON i.id = p.invoice_id
          JOIN students s ON s.id = i.student_id
         WHERE p.status = 'COMPLETED' AND ($1::uuid IS NULL OR s.centre_id = $1)) AS collected_cents,
       (SELECT COALESCE(SUM(ib.outstanding_cents), 0)::int
          FROM invoice_balances ib
          JOIN students s ON s.id = ib.student_id
         WHERE ib.status IN ('UNPAID', 'PARTIALLY_PAID')
           AND ($1::uuid IS NULL OR s.centre_id = $1)) AS outstanding_cents,
       (SELECT COUNT(*)::int FROM grading_sessions g
         WHERE g.starts_at >= now() AND g.status = 'SCHEDULED'
           AND ($1::uuid IS NULL OR g.centre_id = $1)) AS upcoming_gradings`,
    [centreId]
  );
  return rows[0];
}

async function upcomingGradings(centreId, limit) {
  const { rows } = await pool.query(
    `SELECT g.id, g.title, g.type, g.starts_at, c.name AS centre_name, v.name AS venue_name
       FROM grading_sessions g
       JOIN centres c ON c.id = g.centre_id
       LEFT JOIN venues v ON v.id = g.venue_id
      WHERE g.starts_at >= now() AND g.status = 'SCHEDULED'
        AND ($1::uuid IS NULL OR g.centre_id = $1)
      ORDER BY g.starts_at ASC
      LIMIT $2`,
    [centreId, limit]
  );
  return rows;
}

async function recentPayments(centreId, limit) {
  const { rows } = await pool.query(
    `SELECT p.id, p.amount_cents, p.channel, p.paid_at,
            s.first_name, s.last_name, i.invoice_number
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN students s ON s.id = i.student_id
      WHERE p.status = 'COMPLETED' AND ($1::uuid IS NULL OR s.centre_id = $1)
      ORDER BY p.paid_at DESC
      LIMIT $2`,
    [centreId, limit]
  );
  return rows;
}

// Collected and invoiced totals per month (Singapore time), oldest first, for the last `months` months.
async function monthlySeries(centreId, months) {
  const { rows } = await pool.query(
    `WITH months AS (
       SELECT to_char(m, 'YYYY-MM') AS month
         FROM generate_series(
           date_trunc('month', now() AT TIME ZONE 'Asia/Singapore') - ($2 - 1) * interval '1 month',
           date_trunc('month', now() AT TIME ZONE 'Asia/Singapore'),
           interval '1 month') AS m
     )
     SELECT mo.month,
       COALESCE((SELECT SUM(p.amount_cents)
          FROM payments p
          JOIN invoices i ON i.id = p.invoice_id
          JOIN students s ON s.id = i.student_id
         WHERE p.status = 'COMPLETED' AND ($1::uuid IS NULL OR s.centre_id = $1)
           AND to_char(p.paid_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM') = mo.month), 0)::int AS collected_cents,
       COALESCE((SELECT SUM(i.amount_cents)
          FROM invoices i
          JOIN students s ON s.id = i.student_id
         WHERE ($1::uuid IS NULL OR s.centre_id = $1)
           AND to_char(i.issued_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM') = mo.month), 0)::int AS invoiced_cents
       FROM months mo
      ORDER BY mo.month`,
    [centreId, months]
  );
  return rows;
}

module.exports = { summary, upcomingGradings, recentPayments, monthlySeries };
