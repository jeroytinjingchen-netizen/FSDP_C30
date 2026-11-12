// model/billingModel.js - fee items, invoices, payments and balances (AS-27, AS-28, AS-29, AS-30)
const pool = require('../dbConfig');

async function listFeeItems(centreId) {
  const { rows } = await pool.query(
    `SELECT f.id, f.centre_id, c.name AS centre_name, f.term_id, t.name AS term_name,
            f.name, f.description, f.amount_cents, f.currency, f.due_date, f.is_active
       FROM fee_items f
       LEFT JOIN centres c ON c.id = f.centre_id
       LEFT JOIN terms t ON t.id = f.term_id
      WHERE ($1::uuid IS NULL OR f.centre_id IS NULL OR f.centre_id = $1)
      ORDER BY f.due_date DESC, f.name`,
    [centreId]
  );
  return rows;
}

async function createFeeItem(data) {
  const { rows } = await pool.query(
    `INSERT INTO fee_items (centre_id, term_id, name, description, amount_cents, currency, due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [data.centre_id || null, data.term_id || null, data.name, data.description || null, data.amount_cents, data.currency, data.due_date]
  );
  return rows[0].id;
}

// Creates one invoice per active student in the fee's scope. UNIQUE (student_id, fee_item_id) makes it idempotent.
async function generateInvoices(feeItemId) {
  const { rows } = await pool.query(
    `WITH fee AS (SELECT * FROM fee_items WHERE id = $1),
     targets AS (
       SELECT s.id AS student_id, fee.id AS fee_item_id, fee.name, fee.amount_cents, fee.currency, fee.due_date
         FROM students s, fee
        WHERE s.is_active
          AND (fee.centre_id IS NULL OR s.centre_id = fee.centre_id)
     ),
     ins AS (
       INSERT INTO invoices (student_id, fee_item_id, description, amount_cents, currency, due_date)
       SELECT student_id, fee_item_id, name, amount_cents, currency, due_date FROM targets
       ON CONFLICT (student_id, fee_item_id) DO NOTHING
       RETURNING id
     )
     SELECT COUNT(*)::int AS created FROM ins`,
    [feeItemId]
  );
  return rows[0].created;
}

const INVOICE_SELECT = `
  SELECT ib.id, ib.invoice_number, ib.student_id, s.first_name, s.last_name, s.email,
         i.description, ib.amount_cents, ib.paid_cents, ib.outstanding_cents, i.currency,
         ib.due_date, ib.status, ib.is_overdue, i.issued_at, i.paid_at
    FROM invoice_balances ib
    JOIN invoices i ON i.id = ib.id
    JOIN students s ON s.id = ib.student_id`;

async function listInvoices({ centreId, status, studentId }) {
  const { rows } = await pool.query(
    `    ${INVOICE_SELECT}
    WHERE ($1::uuid IS NULL OR s.centre_id = $1)
       AND ($2::text IS NULL OR ib.status::text = $2)
       AND ($3::uuid IS NULL OR ib.student_id = $3)
     ORDER BY ib.due_date, ib.invoice_number`,
    [centreId, status || null, studentId || null]
  );
  return rows;
}

async function findInvoice(id) {
  const { rows } = await pool.query(`${INVOICE_SELECT} WHERE ib.id = $1`, [id]);
  return rows[0] || null;
}

async function listPayments(invoiceId) {
  const { rows } = await pool.query(
    `SELECT id, amount_cents, channel, status, paid_at, reference, notes, recorded_by_id
       FROM payments WHERE invoice_id = $1 ORDER BY paid_at`,
    [invoiceId]
  );
  return rows;
}

// Records a manual payment. The invoice status is recalculated in the same transaction.
async function recordPayment(invoiceId, { amount_cents, channel, reference, notes, recorded_by_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query('SELECT id, amount_cents, status FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    if (!inv.rows[0]) {
      await client.query('ROLLBACK');
      return { status: 'NOT_FOUND' };
    }
    if (inv.rows[0].status === 'VOID') {
      await client.query('ROLLBACK');
      return { status: 'VOID' };
    }
    await client.query(
      `INSERT INTO payments (invoice_id, amount_cents, channel, status, reference, notes, recorded_by_id)
       VALUES ($1,$2,$3,'COMPLETED',$4,$5,$6)`,
      [invoiceId, amount_cents, channel, reference || null, notes || null, recorded_by_id]
    );
    const { rows } = await client.query(
      `SELECT i.amount_cents - COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'COMPLETED'), 0) AS outstanding
         FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id
        WHERE i.id = $1 GROUP BY i.amount_cents`,
      [invoiceId]
    );
    const outstanding = Number(rows[0].outstanding);
    const newStatus = outstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    await client.query(
      `UPDATE invoices
          SET status = $2::invoice_status,
              paid_at = CASE WHEN $2::text = 'PAID' THEN now() ELSE NULL END
        WHERE id = $1`,
      [invoiceId, newStatus]
    );
    await client.query('COMMIT');
    return { status: 'RECORDED', invoice_status: newStatus, outstanding_cents: Math.max(outstanding, 0) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Payment dashboard totals: collected, outstanding and overdue for the chosen centre.
async function summary(centreId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(ib.paid_cents), 0)::int AS collected_cents,
            COALESCE(SUM(ib.outstanding_cents) FILTER (WHERE ib.status IN ('UNPAID','PARTIALLY_PAID')), 0)::int AS outstanding_cents,
            COALESCE(SUM(ib.outstanding_cents) FILTER (WHERE ib.is_overdue), 0)::int AS overdue_cents,
            COUNT(*) FILTER (WHERE ib.is_overdue)::int AS overdue_count
       FROM invoice_balances ib
       JOIN students s ON s.id = ib.student_id
      WHERE ($1::uuid IS NULL OR s.centre_id = $1)`,
    [centreId]
  );
  return rows[0];
}

module.exports = {
  listFeeItems,
  createFeeItem,
  generateInvoices,
  listInvoices,
  findInvoice,
  listPayments,
  recordPayment,
  summary,
};
