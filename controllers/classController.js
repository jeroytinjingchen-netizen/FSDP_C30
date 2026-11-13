// controllers/classController.js - templates, sessions, instructor assignment and conflicts (AS-11, AS-12, AS-13)
const Joi = require('joi');
const Class = require('../model/classModel');

const uuid = () => Joi.string().guid({ version: 'uuidv4' });

const templateSchema = Joi.object({
  term_id: uuid().required(),
  venue_id: uuid().required(),
  level_rank_id: uuid().allow('', null),
  name: Joi.string().trim().min(1).max(150).required(),
  weekday: Joi.number().integer().min(0).max(6).required(),
  start_minute: Joi.number().integer().min(0).max(1439).required(),
  end_minute: Joi.number().integer().min(1).max(1440).greater(Joi.ref('start_minute')).required(),
  instructor_ids: Joi.array().items(uuid()).default([]),
});

const sessionPatchSchema = Joi.object({
  venue_id: uuid(),
  status: Joi.string().valid('SCHEDULED', 'COMPLETED', 'CANCELLED'),
  note: Joi.string().max(500).allow('', null),
  instructor_ids: Joi.array().items(uuid()),
}).min(1);

async function listTemplates(req, res) {
  try {
    res.json(await Class.listTemplates(req.query.termId || null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load class templates.' });
  }
}

async function createTemplate(req, res) {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Class.createTemplate(value));
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Term, venue or rank not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create class template.' });
  }
}

async function updateTemplate(req, res) {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Class.updateTemplate(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Class template not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Class template not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Venue or rank not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update class template.' });
  }
}

async function removeTemplate(req, res) {
  try {
    if (!(await Class.removeTemplate(req.params.id))) return res.status(404).json({ error: 'Class template not found.' });
    res.json({ message: 'Class template deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Class template not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete class template.' });
  }
}

async function generateSessions(req, res) {
  try {
    const template = await Class.findTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Class template not found.' });
    const created = await Class.generateSessions(req.params.id);
    res.status(201).json({ created });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Class template not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to generate sessions.' });
  }
}

async function listSessions(req, res) {
  try {
    res.json(
      await Class.listSessions({
        centreId: req.centreId,
        from: req.query.from,
        to: req.query.to,
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sessions.' });
  }
}

// Returns the session with conflicts (if any) so the admin can see them before the save is accepted.
async function patchSession(req, res) {
  const { error, value } = sessionPatchSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const session = await Class.findSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    if (value.instructor_ids) {
      const instructorIds = value.instructor_ids;
      const venueId = value.venue_id || session.venue_id;
      const conflicts = await Class.findConflicts(session.id, instructorIds, venueId, session.starts_at, session.ends_at);
      if (conflicts.length) {
        return res.status(409).json({ error: 'Scheduling conflict.', conflicts });
      }
      await Class.setSessionInstructors(session.id, instructorIds);
    }

    if (value.venue_id || value.status || value.note !== undefined) {
      const venueId = value.venue_id || session.venue_id;
      if (value.venue_id) {
        const instructorIds = session.instructors.map((i) => i.id);
        const conflicts = await Class.findConflicts(session.id, instructorIds, venueId, session.starts_at, session.ends_at);
        if (conflicts.length) return res.status(409).json({ error: 'Scheduling conflict.', conflicts });
      }
      await Class.updateSessionFields(session.id, {
        venue_id: venueId,
        status: value.status || null,
        note: value.note === undefined ? null : value.note,
      });
    }

    res.json(await Class.findSession(session.id));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Session not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Venue or instructor not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update session.' });
  }
}

// Read-only conflict check for a whole term, for the timetable warning panel (AS-13).
async function checkConflicts(req, res) {
  try {
    const conflicts = await Class.findAllConflicts({ centreId: req.centreId });
    res.json({ count: conflicts.length, conflicts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check conflicts.' });
  }
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  removeTemplate,
  generateSessions,
  listSessions,
  patchSession,
  checkConflicts,
};
