// services/emailService.js
// Single wrapper for every outgoing email, sent through Resend. Each attempt is written to notification_log.
// If RESEND_API_KEY is not set, nothing is sent. The attempt is logged as FAILED with the reason,
// so the notification log still shows what would have gone out.
const { Resend } = require('resend');
const pool = require('../dbConfig');

const FROM = process.env.RESEND_FROM || 'Aikido Shinjukai <onboarding@resend.dev>';
let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.RESEND_API_KEY) return null;
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

async function deliver(to, subject, text) {
  const resend = getClient();
  if (!resend) throw new Error('RESEND_API_KEY is not configured');
  const { error } = await resend.emails.send({ from: FROM, to, subject, text });
  if (error) throw new Error(error.message || 'Resend rejected the email');
}

// Sends one email and records the result. Returns { status, id }.
// dedupeKey is UNIQUE in notification_log. A repeated key means the message was already
// handled, so it is skipped. This is what stops the same reminder going out twice.
async function sendEmail({ to, subject, text, type, studentId = null, invoiceId = null, candidateId = null, dedupeKey = null }) {
  const insert = await pool.query(
    `INSERT INTO notification_log (student_id, invoice_id, candidate_id, type, channel, status, recipient, subject, dedupe_key)
     VALUES ($1,$2,$3,$4,'EMAIL','PENDING',$5,$6,$7)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [studentId, invoiceId, candidateId, type, to, subject, dedupeKey]
  );
  if (insert.rowCount === 0) return { status: 'SKIPPED_DUPLICATE', id: null };
  const logId = insert.rows[0].id;

  try {
    await deliver(to, subject, text);
    await pool.query(
      `UPDATE notification_log SET status='SENT', attempts=attempts+1, sent_at=now() WHERE id=$1`,
      [logId]
    );
    return { status: 'SENT', id: logId };
  } catch (err) {
    await pool.query(
      `UPDATE notification_log SET status='FAILED', attempts=attempts+1, error_message=$2 WHERE id=$1`,
      [logId, err.message]
    );
    return { status: 'FAILED', id: logId };
  }
}

// Re-sends a FAILED log entry. Used by the retry button in the admin notification log.
// The original body is not stored, so the retry sends the subject with a short standard note.
async function retryNotification(logId) {
  const { rows } = await pool.query(
    `SELECT id, recipient, subject FROM notification_log WHERE id=$1 AND status='FAILED'`,
    [logId]
  );
  if (!rows.length) return null;
  const n = rows[0];
  try {
    await deliver(n.recipient, n.subject, 'This is a resent notification from Aikido Shinjukai. Please check your account for details.');
    await pool.query(
      `UPDATE notification_log SET status='SENT', attempts=attempts+1, sent_at=now(), error_message=NULL WHERE id=$1`,
      [logId]
    );
    return 'SENT';
  } catch (err) {
    await pool.query(
      `UPDATE notification_log SET attempts=attempts+1, error_message=$2 WHERE id=$1`,
      [logId, err.message]
    );
    return 'FAILED';
  }
}

module.exports = { sendEmail, retryNotification };
