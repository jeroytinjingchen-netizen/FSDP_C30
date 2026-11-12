// controllers/instructorController.js - instructors and availability (AS-8)
const Joi = require('joi');
const Instructor = require('../model/instructorModel');

const uuid = () => Joi.string().guid({ version: 'uuidv4' });

const schema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().max(30).allow('', null),
  rank_id: uuid().allow('', null),
  qualifications: Joi.string().max(500).allow('', null),
  centre_ids: Joi.array().items(uuid()).min(1).required(),
});

// weekday: 0 = Monday ... 6 = Sunday. Minutes are minutes since midnight in Singapore time.
const availabilitySchema = Joi.object({
  slots: Joi.array()
    .items(
      Joi.object({
        weekday: Joi.number().integer().min(0).max(6).required(),
        start_minute: Joi.number().integer().min(0).max(1439).required(),
        end_minute: Joi.number().integer().min(1).max(1440).greater(Joi.ref('start_minute')).required(),
      })
    )
    .required(),
});

async function list(req, res) {
  try {
    res.json(await Instructor.list(req.centreId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load instructors.' });
  }
}

async function create(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Instructor.create(value));
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Centre or rank not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create instructor.' });
  }
}

async function update(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Instructor.update(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Instructor not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Instructor not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Centre or rank not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update instructor.' });
  }
}

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

async function getAvailability(req, res) {
  try {
    res.json(await Instructor.listAvailability(req.params.id));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Instructor not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load availability.' });
  }
}

async function putAvailability(req, res) {
  const { error, value } = availabilitySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    if (!(await Instructor.findById(req.params.id))) return res.status(404).json({ error: 'Instructor not found.' });
    res.json(await Instructor.replaceAvailability(req.params.id, value.slots));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Instructor not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to save availability.' });
  }
}

module.exports = {
  list,
  create,
  update,
  deactivate: setActive(false),
  activate: setActive(true),
  getAvailability,
  putAvailability,
};
