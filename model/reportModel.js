// model/reportModel.js - financial report queries (AS-45)
const pool = require('../dbConfig');

// Totals and transactions for payments paid, and invoices issued, within [from, to].
// `to` is an exclusive upper bound (the day after the chosen end date).
async function financialReport(centreId, from, to) {
  const { rows: totals } = await pool.query(
    `SELECT
       (SELECT COALESCE(SUM(p.amount_cents), 0)::int
          FROM payments p
          JOIN invoices i ON i.id = p.invoice_id
          JOIN students s ON s.id = i.student_id
         WHERE p.status = 'COMPLETED'
           AND p.paid_at >= $2 AND p.paid_at < $3
           AND ($1::uuid IS NULL OR s.centre_id = $1)) AS collected_cents,
       (SELECT COALESCE(SUM(ib.outstanding_cents), 0)::int
          FROM invoice_balances ib
          JOIN students s ON s.id = ib.student_id
         WHERE ib.status IN ('UNPAID', 'PARTIALLY_PAID')
           AND ($1::uuid IS NULL OR s.centre_id = $1)) AS outstanding_cents,
       (SELECT COALESCE(SUM(i.amount_cents), 0)::int
          FROM invoices i
          JOIN students s ON s.id = i.student_id
         WHERE i.issued_at >= $2 AND i.issued_at < $3
           AND ($1::uuid IS NULL OR s.centre_id = $1)) AS invoiced_cents`,
    [centreId, from, to]
  );

  const { rows: transactions } = await pool.query(
    `SELECT p.id, p.paid_at, p.amount_cents, p.channel, p.reference,
            i.invoice_number, s.first_name, s.last_name, c.name AS centre_name
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN students s ON s.id = i.student_id
       JOIN centres c ON c.id = s.centre_id
      WHERE p.status = 'COMPLETED'
        AND p.paid_at >= $2 AND p.paid_at < $3
        AND ($1::uuid IS NULL OR s.centre_id = $1)
      ORDER BY p.paid_at DESC`,
    [centreId, from, to]
  );

  return { totals: totals[0], transactions };
}

module.exports = { financialReport };
