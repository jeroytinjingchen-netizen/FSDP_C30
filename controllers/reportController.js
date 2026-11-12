// controllers/reportController.js - financial reports (AS-45)
const Joi = require('joi');
const Report = require('../model/reportModel');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = Joi.object({
  from: Joi.string().pattern(DATE_RE).required(),
  to: Joi.string().pattern(DATE_RE).required(),
});

// Returns the start of `from` and the start of the day after `to` (Singapore time).
function toBounds({ from, to }) {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function financialReport(req, res) {
  const { error, value } = querySchema.validate(req.query);
  if (error) return res.status(400).json({ error: 'Provide from and to as YYYY-MM-DD.' });

  const { start, end } = toBounds(value);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ error: 'The to date must be on or after the from date.' });
  }

  try {
    const report = await Report.financialReport(req.centreId, start, end);
    res.json({ from: value.from, to: value.to, ...report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build report.' });
  }
}

// Quotes a CSV cell and neutralises spreadsheet formula injection.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function financialReportCsv(req, res) {
  const { error, value } = querySchema.validate(req.query);
  if (error) return res.status(400).json({ error: 'Provide from and to as YYYY-MM-DD.' });

  const { start, end } = toBounds(value);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ error: 'The to date must be on or after the from date.' });
  }

  try {
    const { totals, transactions } = await Report.financialReport(req.centreId, start, end);
    const lines = [
      ['Financial report', `${value.from} to ${value.to}`].map(csvCell).join(','),
      ['Collected (SGD)', (totals.collected_cents / 100).toFixed(2)].map(csvCell).join(','),
      ['Invoiced in range (SGD)', (totals.invoiced_cents / 100).toFixed(2)].map(csvCell).join(','),
      ['Outstanding, all unpaid balances (SGD)', (totals.outstanding_cents / 100).toFixed(2)].map(csvCell).join(','),
      '',
      ['Paid at (UTC)', 'Invoice', 'Student', 'Centre', 'Channel', 'Reference', 'Amount (SGD)']
        .map(csvCell)
        .join(','),
      ...transactions.map((t) =>
        [
          new Date(t.paid_at).toISOString(),
          t.invoice_number,
          `${t.first_name} ${t.last_name}`,
          t.centre_name,
          t.channel,
          t.reference,
          (t.amount_cents / 100).toFixed(2),
        ]
          .map(csvCell)
          .join(',')
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report_${value.from}_${value.to}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export report.' });
  }
}

module.exports = { financialReport, financialReportCsv, toBounds, csvCell };
