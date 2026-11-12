// controllers/billingController.js - fees, invoices and manual payments (AS-27, AS-28, AS-29, AS-30)
const Joi = require('joi');
const Billing = require('../model/billingModel');

const uuid = () => Joi.string().guid({ version: 'uuidv4' });

const feeSchema = Joi.object({
  centre_id: uuid().allow('', null),
  term_id: uuid().allow('', null),
  name: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().max(500).allow('', null),
  amount_cents: Joi.number().integer().min(0).required(),
  currency: Joi.string().length(3).uppercase().default('SGD'),
  due_date: Joi.date().iso().required(),
});

const paymentSchema = Joi.object({
  amount_cents: Joi.number().integer().min(1).required(),
  channel: Joi.string().valid('CASH', 'BANK_TRANSFER', 'WHATSAPP', 'EMAIL', 'OTHER').required(),
  reference: Joi.string().max(150).allow('', null),
  notes: Joi.string().max(500).allow('', null),
});

async function listFeeItems(req, res) {
  try {
    res.json(await Billing.listFeeItems(req.centreId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load fee items.' });
  }
}

async function createFeeItem(req, res) {
  const { error, value } = feeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const id = await Billing.createFeeItem(value);
    res.status(201).json({ id });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Centre or term not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create fee item.' });
  }
}

async function generateInvoices(req, res) {
  try {
    const created = await Billing.generateInvoices(req.params.id);
    res.status(201).json({ created });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Fee item not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to generate invoices.' });
  }
}

async function listInvoices(req, res) {
  try {
    res.json(
      await Billing.listInvoices({
        centreId: req.centreId,
        status: req.query.status,
        studentId: req.query.studentId,
      })
    );
  } catch (err) {
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid studentId.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load invoices.' });
  }
}

async function getInvoice(req, res) {
  try {
    const invoice = await Billing.findInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ ...invoice, payments: await Billing.listPayments(req.params.id) });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Invoice not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load invoice.' });
  }
}

async function recordPayment(req, res) {
  const { error, value } = paymentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const result = await Billing.recordPayment(req.params.id, { ...value, recorded_by_id: req.adminId });
    if (result.status === 'NOT_FOUND') return res.status(404).json({ error: 'Invoice not found.' });
    if (result.status === 'VOID') return res.status(409).json({ error: 'Cannot record payment on a void invoice.' });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Invoice not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
}

async function summary(req, res) {
  try {
    res.json(await Billing.summary(req.centreId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load payment summary.' });
  }
}

module.exports = { listFeeItems, createFeeItem, generateInvoices, listInvoices, getInvoice, recordPayment, summary };
