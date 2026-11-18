// controllers/classController.js - HTTP handlers for classes (AS-4) and instructor assignment (AS-6).
//
// A controller reads the request (req), validates it, calls the model, and writes the response (res).
// Joi is a validation library: Joi.object({...}).validate(data) returns { error, value }.
const Joi = require('joi');
const Class = require('../model/classModel');

// Shortcut for "a UUID string". A function is used so each field gets its own Joi object.
const uuid = () => Joi.string().guid({ version: 'uuidv4' });

// Rules for creating or editing a class.
// weekday: 0 = Monday ... 6 = Sunday. start/end are minutes since midnight (e.g. 600 = 10:00).
const classSchema = Joi.object({
  centre_id: uuid().required(),
  name: Joi.string().trim().min(1).max(150).required(),
  weekday: Joi.number().integer().min(0).max(6).required(),
  start_minute: Joi.number().integer().min(0).max(1439).required(),
  // greater(Joi.ref('start_minute')) makes sure the class ends after it starts.
  end_minute: Joi.number().integer().min(1).max(1440).greater(Joi.ref('start_minute')).required(),
});

// instructor_id may be null, which removes the instructor from the class.
const assignSchema = Joi.object({ instructor_id: uuid().allow(null).required() });

// GET /api/classes?centreId=...  (req.centreId is set by the centreFilter middleware)
async function list(req, res) {
  try {
    res.json(await Class.list(req.centreId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load classes.' });
  }
}

// POST /api/classes
async function create(req, res) {
  const { error, value } = classSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Class.create(value));
  } catch (err) {
    // 23503 = foreign key violation in Postgres (the centre does not exist).
    if (err.code === '23503') return res.status(400).json({ error: 'Centre not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create class.' });
  }
}

// PUT /api/classes/:id
async function update(req, res) {
  const { error, value } = classSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Class.update(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Class not found.' });
    res.json(updated);
  } catch (err) {
    // 22P02 = invalid text representation, i.e. the :id in the URL is not a valid UUID.
    if (err.code === '22P02') return res.status(404).json({ error: 'Class not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Centre not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update class.' });
  }
}

// DELETE /api/classes/:id
async function remove(req, res) {
  try {
    if (!(await Class.remove(req.params.id))) return res.status(404).json({ error: 'Class not found.' });
    res.json({ message: 'Class removed.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Class not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to remove class.' });
  }
}

// PUT /api/classes/:id/instructor  body: { instructor_id: "<uuid>" | null }
// One handler covers assign, reassign and remove.
async function assignInstructor(req, res) {
  const { error, value } = assignSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Class.setInstructor(req.params.id, value.instructor_id);
    if (!updated) return res.status(404).json({ error: 'Class not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Class not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Instructor not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to assign instructor.' });
  }
}

module.exports = { list, create, update, remove, assignInstructor };
