// services/reminderService.js
// Finds unpaid invoices that need an upcoming reminder or an overdue notice, and sends them.
// Each send uses a dedupe key, so running the job again never repeats a reminder.
const pool = require('../dbConfig');
const { sendEmail } = require('./emailService');

const DEFAULTS = { reminderDaysBefore: 3, overdueIntervalsDays: [1, 7, 14] };

async function getSettings() {
  const { rows } = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [
    ['reminderDaysBefore', 'overdueIntervalsDays'],
  ]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    reminderDaysBefore: Number.isInteger(map.reminderDaysBefore) ? map.reminderDaysBefore : DEFAULTS.reminderDaysBefore,
    overdueIntervalsDays: Array.isArray(map.overdueIntervalsDays) ? map.overdueIntervalsDays : DEFAULTS.overdueIntervalsDays,
  };
}

function formatMoney(cents) {
  return `SGD ${(cents / 100).toFixed(2)}`;
}

function buildMessage(kind, row) {
  const name = `${row.first_name} ${row.last_name}`;
  const amount = formatMoney(row.outstanding_cents);
  const due = new Date(row.due_date).toISOString().slice(0, 10);
  if (kind === 'reminder') {
    return {
      subject: `Upcoming fee due: ${row.invoice_number}`,
      text: `Hi ${name},\n\nInvoice ${row.invoice_number} for ${amount} is due on ${due}.\n\nPlease pay before the due date. Thank you.\nAikido Shinjukai`,
    };
  }
  return {
    subject: `Overdue fee: ${row.invoice_number}`,
    text: `Hi ${name},\n\nInvoice ${row.invoice_number} for ${amount} was due on ${due} and is still unpaid.\n\nPlease settle it as soon as possible. Thank you.\nAikido Shinjukai`,
  };
}

// Invoices unpaid, not yet overdue, due in exactly N days. Only the student email is used.
async function findUpcoming(days) {
  const { rows } = await pool.query(
    `SELECT b.id AS invoice_id, b.invoice_number, b.outstanding_cents, b.due_date,
            s.id AS student_id, s.first_name, s.last_name, s.email
       FROM invoice_balances b
       JOIN students s ON s.id = b.student_id
      WHERE b.outstanding_cents > 0
        AND b.status IN ('UNPAID','PARTIALLY_PAID')
        AND b.due_date = CURRENT_DATE + $1::int
        AND s.email IS NOT NULL`,
    [days]
  );
  return rows;
}

// Invoices that are overdue by exactly one of the configured intervals.
async function findOverdue(days) {
  const { rows } = await pool.query(
    `SELECT b.id AS invoice_id, b.invoice_number, b.outstanding_cents, b.due_date,
            s.id AS student_id, s.first_name, s.last_name, s.email
       FROM invoice_balances b
       JOIN students s ON s.id = b.student_id
      WHERE b.outstanding_cents > 0
        AND b.is_overdue
        AND b.due_date = CURRENT_DATE - $1::int
        AND s.email IS NOT NULL`,
    [days]
  );
  return rows;
}

// Runs the whole job once. Used by the manual trigger endpoint and by a daily timer.
async function runReminders() {
  const settings = await getSettings();
  const summary = { upcoming: 0, overdue: 0, skipped: 0, failed: 0 };

  const upcoming = await findUpcoming(settings.reminderDaysBefore);
  for (const row of upcoming) {
    const msg = buildMessage('reminder', row);
    const result = await sendEmail({
      to: row.email,
      ...msg,
      type: 'PAYMENT_REMINDER',
      studentId: row.student_id,
      invoiceId: row.invoice_id,
      dedupeKey: `reminder:${row.invoice_id}:${settings.reminderDaysBefore}d`,
    });
    if (result.status === 'SENT') summary.upcoming++;
    else if (result.status === 'FAILED') summary.failed++;
    else summary.skipped++;
  }

  for (const days of settings.overdueIntervalsDays) {
    const overdue = await findOverdue(days);
    for (const row of overdue) {
      const msg = buildMessage('overdue', row);
      const result = await sendEmail({
        to: row.email,
        ...msg,
        type: 'OVERDUE_NOTICE',
        studentId: row.student_id,
        invoiceId: row.invoice_id,
        dedupeKey: `overdue:${row.invoice_id}:${days}d`,
      });
      if (result.status === 'SENT') summary.overdue++;
      else if (result.status === 'FAILED') summary.failed++;
      else summary.skipped++;
    }
  }

  return summary;
}

// Admin manual send for one invoice. Overdue notices use a timestamped key so it is not blocked.
async function sendManualOverdue(invoiceId) {
  const { rows } = await pool.query(
    `SELECT b.id AS invoice_id, b.invoice_number, b.outstanding_cents, b.due_date,
            s.id AS student_id, s.first_name, s.last_name, s.email
       FROM invoice_balances b
       JOIN students s ON s.id = b.student_id
      WHERE b.id = $1 AND b.outstanding_cents > 0 AND s.email IS NOT NULL`,
    [invoiceId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const msg = buildMessage('overdue', row);
  return sendEmail({
    to: row.email,
    ...msg,
    type: 'OVERDUE_NOTICE',
    studentId: row.student_id,
    invoiceId: row.invoice_id,
    dedupeKey: `manual:${row.invoice_id}:${Date.now()}`,
  });
}

module.exports = { runReminders, sendManualOverdue, getSettings };
