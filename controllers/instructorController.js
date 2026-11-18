// controllers/instructorController.js - HTTP handlers for instructors (AS-5).
//
// A controller validates the request, calls the model, and writes the response.
// Joi is a validation library: schema.validate(data) returns { error, value }.
const Joi = require('joi');
const Instructor = require('../model/instructorModel');

// Shortcut for "a UUID string".
const uuid = () => Joi.string().guid({ version: 'uuidv4' });

// Rules for the instructor form. allow('', null) lets optional fields be blank.
const schema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  email: Joi.string().trim().email().allow('', null),
  phone: Joi.string().trim().max(30).allow('', null),
  rank_id: uuid().allow('', null),
  qualifications: Joi.string().max(500).allow('', null),
});

// GET /api/instructors?q=...&centreId=...
// req.centreId is set by the centreFilter middleware.
async function list(req, res) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    res.json(await Instructor.list(req.centreId, q || null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load instructors.' });
  }
}

// POST /api/instructors
// Postgres error 23503 = foreign key violation (the rank does not exist).
async function create(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Instructor.create(value));
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Rank not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create instructor.' });
  }
}

// PUT /api/instructors/:id
// Postgres error 22P02 = the id in the URL is not a valid UUID, so treat it as not found.
async function update(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Instructor.update(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Instructor not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Instructor not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Rank not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update instructor.' });
  }
}

// Factory: returns a handler that deactivates (false) or activates (true) an instructor.
function setActive(isActive) {
  return async (req, res) => {
    try {
      if (!(await Instructor.setActive(req.params.id, isActive))) {
        return res.status(404).json({ error: 'Instructor not found.' });
      }
      res.json(await Instructor.findById(req.params.id));
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ error: 'Instructor not found.' });
      console.error(err);
      res.status(500).json({ error: 'Failed to update instructor.' });
    }
  };
}

module.exports = { list, create, update, deactivate: setActive(false), activate: setActive(true) };
