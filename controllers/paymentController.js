// controllers/paymentController.js - admin payments list and CSV export (AS-12, AS-13)
// A controller reads the request, validates it, calls the model and sends the response.

// Joi validates the query string (the ?key=value part of the URL).
const Joi = require('joi');
const Payment = require('../model/paymentModel');
// Shared helpers: csvCell quotes a value and blocks spreadsheet formula injection,
// toBounds turns YYYY-MM-DD dates into Singapore-time start and end timestamps.
const { csvCell, toBounds } = require('../utils/csv');

// A date is written as YYYY-MM-DD.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Allowed query parameters. Every filter is optional. Unknown keys are rejected.
const querySchema = Joi.object({
  centreId: Joi.string().allow(''),
  paymentFrom: Joi.string().pattern(DATE_RE).allow(''),
  paymentTo: Joi.string().pattern(DATE_RE).allow(''),
  status: Joi.string().valid('SUCCESSFUL', 'FAILED', 'all', '').optional(),
  search: Joi.string().trim().max(100).allow(''),
});

// Turns a from/to pair of date strings into [startTimestamp, endTimestampExclusive].
// Returns null for an unset side, and { error } if a date is not real or the range is reversed.
function dateRange(from, to) {
  if (!from && !to) return { start: null, end: null };
  const bounds = toBounds({ from: from || to, to: to || from });
  const start = from ? bounds.start : null;
  const end = to ? bounds.end : null;
  const invalid = (d) => d && Number.isNaN(d.getTime());
  if (invalid(start) || invalid(end) || (start && end && start >= end)) return { error: true };
  return { start, end };
}

// Validates the query and converts it to the filter object the model expects.
// Returns { filters } on success or { error } with a message for the admin.
function parseFilters(req) {
  const { error, value } = querySchema.validate(req.query);
  if (error) return { error: 'Invalid filter. Dates must be YYYY-MM-DD.' };

  const payment = dateRange(value.paymentFrom, value.paymentTo);
  if (payment.error) {
    return { error: 'The "to" date must be on or after the "from" date.' };
  }

  return {
    filters: {
      centreId: req.centreId, // set by the centreFilter middleware (null means all centres)
      paymentFrom: payment.start,
      paymentTo: payment.end,
      status: value.status && value.status !== 'all' ? value.status : null,
      search: value.search || null,
    },
  };
}

// GET /api/payments - the filtered list shown on the Payments page.
async function listPayments(req, res) {
  const { filters, error } = parseFilters(req);
  if (error) return res.status(400).json({ error });
  try {
    const payments = await Payment.list(filters);
    // Total collected for the rows shown. Only Successful payments count.
    // reduce() adds up the amounts one row at a time, starting from 0.
    const totalCollectedCents = payments
      .filter((p) => p.status === 'SUCCESSFUL')
      .reduce((sum, p) => sum + p.amount_cents, 0);
    res.json({ payments, totalCollectedCents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load payments.' });
  }
}

// Formats a timestamp as ISO 8601 text (UTC) for the CSV, or '' when there is none.
const isoOrBlank = (value) => (value ? new Date(value).toISOString() : '');

// GET /api/payments/export.csv - downloads the same filtered list as a CSV file.
// It runs the same filters as the list, so the file matches what the admin sees.
async function exportPaymentsCsv(req, res) {
  const { filters, error } = parseFilters(req);
  if (error) return res.status(400).json({ error });
  try {
    const rows = await Payment.list(filters);
    const header = [
      'Student', 'Centre', 'Package', 'Amount (SGD)',
      'Payment date (UTC)',
      'Payment method', 'Reference', 'Status',
    ];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((p) =>
        [
          `${p.first_name} ${p.last_name}`,
          p.centre_name,
          p.package_name || '',
          (p.amount_cents / 100).toFixed(2),
          isoOrBlank(p.paid_at),
          p.payment_method,
          p.reference || '',
          p.status === 'SUCCESSFUL' ? 'Successful' : 'Failed',
        ]
          .map(csvCell)
          .join(',')
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    // \uFEFF is a byte order mark so Excel opens the file as UTF-8.
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export payments.' });
  }
}

module.exports = { listPayments, exportPaymentsCsv };
