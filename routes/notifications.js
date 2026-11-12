// routes/notifications.js
// Admin-only endpoints for the notification log, the reminder job and manual sends.
const express = require('express');
const pool = require('../dbConfig');
const { requireAdmin } = require('../middlewares/admin');
const { runReminders, sendManualOverdue } = require('../services/reminderService');
const { retryNotification } = require('../services/emailService');

const router = express.Router();
router.use(requireAdmin);

// Notification log with optional filters: ?status=SENT|FAILED|PENDING&type=PAYMENT_REMINDER
router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`n.status = $${params.length}::notification_status`);
    }
    if (req.query.type) {
      params.push(req.query.type);
      where.push(`n.type = $${params.length}::notification_type`);
    }
    const sql = `
      SELECT n.id, n.type, n.status, n.recipient, n.subject, n.error_message,
             n.attempts, n.sent_at, n.created_at, n.invoice_id, n.dedupe_key
        FROM notification_log n
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY n.created_at DESC
       LIMIT 200`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Runs the reminder and overdue job once. Duplicates are skipped by dedupe_key.
router.post('/run', async (req, res, next) => {
  try {
    const summary = await runReminders();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Admin sends an overdue reminder for one invoice.
router.post('/invoices/:id/remind', async (req, res, next) => {
  try {
    const result = await sendManualOverdue(req.params.id);
    if (!result) return res.status(404).json({ error: 'Invoice not found or has no outstanding balance.' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Retries a FAILED send.
router.post('/:id/retry', async (req, res, next) => {
  try {
    const status = await retryNotification(req.params.id);
    if (!status) return res.status(404).json({ error: 'No failed notification with that id.' });
    res.json({ status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
