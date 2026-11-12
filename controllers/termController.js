// controllers/termController.js - terms per centre (AS-10)
const Joi = require('joi');
const Term = require('../model/termModel');

const schema = Joi.object({
  centre_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
});

const toDateOnly = (d) => new Date(d).toISOString().slice(0, 10);

async function list(req, res) {
  try {
    res.json(await Term.list(req.centreId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load terms.' });
  }
}

async function create(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const payload = { ...value, start_date: toDateOnly(value.start_date), end_date: toDateOnly(value.end_date) };
    if (await Term.overlaps(payload.centre_id, payload.start_date, payload.end_date)) {
      return res.status(409).json({ error: 'This term overlaps an existing term in the centre.' });
    }
    res.status(201).json(await Term.create(payload));
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Centre not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create term.' });
  }
}

async function update(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const payload = { ...value, start_date: toDateOnly(value.start_date), end_date: toDateOnly(value.end_date) };
    if (await Term.overlaps(payload.centre_id, payload.start_date, payload.end_date, req.params.id)) {
      return res.status(409).json({ error: 'This term overlaps an existing term in the centre.' });
    }
    const updated = await Term.update(req.params.id, payload);
    if (!updated) return res.status(404).json({ error: 'Term not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Term not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update term.' });
  }
}

async function remove(req, res) {
  try {
    if (!(await Term.remove(req.params.id))) return res.status(404).json({ error: 'Term not found.' });
    res.json({ message: 'Term deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Term not found.' });
    if (err.code === '23503') return res.status(409).json({ error: 'Cannot delete: term has classes.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete term.' });
  }
}

module.exports = { list, create, update, remove };
