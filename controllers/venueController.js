// controllers/venueController.js
const Joi = require('joi');
const Venue = require('../model/venueModel');
const Centre = require('../model/centreModel');

const schema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  capacity: Joi.number().integer().min(1).required(),
});

const createSchema = schema.keys({
  centre_id: Joi.string().guid().required(),
});

// List (archived hidden unless ?includeArchived=true, scoped by ?centreId= via centreFilter)
async function list(req, res) {
  try {
    res.json(await Venue.list(req.centreId, req.query.includeArchived === 'true'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load venues.' });
  }
}

async function create(req, res) {
  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const active = await Centre.isActive(value.centre_id);
    if (active === null) return res.status(400).json({ error: 'Centre not found.' });
    if (!active) return res.status(400).json({ error: 'Cannot add a venue to an archived centre.' });

    res.status(201).json(await Venue.create(value));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A venue with that name already exists at this centre.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create venue.' });
  }
}

// Centre is fixed once a venue is created, so only name and capacity are editable.
async function update(req, res) {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Venue.update(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Venue not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Venue not found.' });
    if (err.code === '23505') return res.status(409).json({ error: 'A venue with that name already exists at this centre.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update venue.' });
  }
}

function setActive(isActive) {
  return async (req, res) => {
    try {
      const venue = await Venue.setActive(req.params.id, isActive);
      if (!venue) return res.status(404).json({ error: 'Venue not found.' });
      res.json(venue);
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ error: 'Venue not found.' });
      console.error(err);
      res.status(500).json({ error: 'Failed to update venue.' });
    }
  };
}

// Hard delete: blocked when the venue is referenced by classes or gradings (archive instead)
async function remove(req, res) {
  try {
    const deleted = await Venue.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Venue not found.' });
    res.json({ message: 'Venue deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Venue not found.' });
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete: venue is used by classes or gradings. Archive it instead.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete venue.' });
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
