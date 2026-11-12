// controllers/centreController.js
const Joi = require('joi');
const Centre = require('../model/centreModel');

const schema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  address: Joi.string().trim().min(1).max(300).required(),
  email: Joi.string().trim().email().allow('', null),
  phone: Joi.string().trim().max(30).allow('', null),
});

// List (archived hidden unless ?includeArchived=true)
async function list(req, res) {
  try {
    res.json(await Centre.list(req.query.includeArchived === 'true'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load centres.' });
  }
}

async function create(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Centre.create(value));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A centre with that name already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create centre.' });
  }
}

async function update(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Centre.update(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Centre not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Centre not found.' });
    if (err.code === '23505') return res.status(409).json({ error: 'A centre with that name already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update centre.' });
  }
}

function setActive(isActive) {
  return async (req, res) => {
    try {
      const centre = await Centre.setActive(req.params.id, isActive);
      if (!centre) return res.status(404).json({ error: 'Centre not found.' });
      res.json(centre);
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ error: 'Centre not found.' });
      console.error(err);
      res.status(500).json({ error: 'Failed to update centre.' });
    }
  };
}

// Hard delete: blocked while the centre has any students (archive instead)
async function remove(req, res) {
  try {
    const students = await Centre.countStudents(req.params.id);
    if (students === null) return res.status(404).json({ error: 'Centre not found.' });
    if (students > 0) {
      return res.status(409).json({
        error: `Cannot delete: this centre has ${students} student(s). Archive it instead.`,
      });
    }
    await Centre.remove(req.params.id);
    res.json({ message: 'Centre deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Centre not found.' });
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete: centre is referenced by other records. Archive it instead.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete centre.' });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  archive: setActive(false),
  restore: setActive(true),
};
