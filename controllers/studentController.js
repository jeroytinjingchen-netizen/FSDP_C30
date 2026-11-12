// controllers/studentController.js - a student sees only their own profile and invoices.
const billing = require('../model/billingModel');
const portal = require('../model/studentPortalModel');
const { createCheckoutForInvoice } = require('../services/stripeService');

function getMe(req, res) {
  return res.json({ student: req.student });
}

async function getMyBelt(req, res, next) {
  try {
    const belt = await portal.getBelt(req.student.id);
    if (!belt) return res.status(404).json({ error: 'Belt record not found.' });
    res.json(belt);
  } catch (err) {
    next(err);
  }
}

async function listMyTimetable(req, res, next) {
  try {
    const allowed = [14, 30, 90];
    const requested = Number(req.query.days) || 14;
    const days = allowed.includes(requested) ? requested : 14;
    const sessions = await portal.listUpcomingSessions(req.student.centre_id, days);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
}

const clean = (value, max) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text.slice(0, max);
};

async function updateMyContact(req, res, next) {
  try {
    const body = req.body || {};
    const contact = {
      phone: clean(body.phone, 30),
      guardian_name: clean(body.guardian_name, 100),
      guardian_phone: clean(body.guardian_phone, 30),
    };
    const updated = await portal.updateContact(req.student.id, contact);
    if (!updated) return res.status(404).json({ error: 'Student profile not found.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function listMyInvoicePayments(req, res, next) {
  try {
    const invoice = await billing.findInvoice(req.params.id);
    if (!invoice || invoice.student_id !== req.student.id) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const payments = await billing.listPayments(invoice.id);
    res.json({ invoice, payments });
  } catch (err) {
    next(err);
  }
}

async function listMyInvoices(req, res, next) {
  try {
    const invoices = await billing.listInvoices({ studentId: req.student.id });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

async function checkoutMyInvoice(req, res, next) {
  try {
    const invoice = await billing.findInvoice(req.params.id);
    // Return the same 404 for other students' invoices so ids cannot be probed.
    if (!invoice || invoice.student_id !== req.student.id) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const result = await createCheckoutForInvoice(invoice.id, { returnPath: '/student' });
    if (result.error === 'NO_BALANCE') return res.status(400).json({ error: 'Invoice has no outstanding balance.' });
    res.json({ url: result.url, sessionId: result.sessionId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  getMyBelt,
  listMyTimetable,
  updateMyContact,
  listMyInvoices,
  listMyInvoicePayments,
  checkoutMyInvoice,
};
