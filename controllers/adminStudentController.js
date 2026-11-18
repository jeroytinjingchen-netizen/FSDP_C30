// controllers/adminStudentController.js - HTTP handlers for student management (AS-7, AS-8, AS-9).
//
// A controller validates the request, calls the model, and writes the response.
// Joi is a validation library: schema.validate(data) returns { error, value }.
const Joi = require('joi');
const Student = require('../model/adminStudentModel');

// Shortcuts for common field types.
const uuid = () => Joi.string().guid({ version: 'uuidv4' });
const optionalText = (max) => Joi.string().trim().max(max).allow('', null);

// Fields shared by add and edit. Rank is NOT editable here; use the rank update endpoint (AS-8).
const detailsSchema = {
  first_name: Joi.string().trim().min(1).max(80).required(),
  last_name: Joi.string().trim().min(1).max(80).required(),
  email: Joi.string().trim().email().max(254).required(),
  phone: optionalText(30),
  date_of_birth: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  guardian_name: optionalText(150),
  guardian_phone: optionalText(30),
  centre_id: uuid().required(),
};
const editSchema = Joi.object(detailsSchema);
// A new student also needs a starting rank. Joi's .keys() adds fields to an existing schema.
const createSchema = Joi.object(detailsSchema).keys({ current_rank_id: uuid().required() });

const rankSchema = Joi.object({
  rank_id: uuid().required(),
  changed_on: Joi.date().iso().allow('', null),
  note: Joi.string().trim().max(300).allow('', null),
  candidate_id: uuid().allow('', null),
});

// GET /api/students?q=...&centreId=...&rankId=...
// req.centreId is set by the centreFilter middleware.
async function list(req, res) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rankId = typeof req.query.rankId === 'string' && req.query.rankId ? req.query.rankId : null;
    res.json(await Student.list({ centreId: req.centreId, rankId, search: q || null }));
  } catch (err) {
    // 22P02 = a filter value was not a valid UUID.
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid filter value.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load students.' });
  }
}

// Turns a database error into a friendly response.
// 23505 = unique violation (duplicate email), 23503 = foreign key violation, 22007/22008 = bad date.
function handleWriteError(err, res, fallback) {
  if (err.code === '23505') return res.status(409).json({ error: 'A student with this email already exists.' });
  if (err.code === '23503') return res.status(400).json({ error: 'Centre or rank not found.' });
  if (err.code === '22007' || err.code === '22008') return res.status(400).json({ error: 'Invalid date of birth.' });
  console.error(err);
  return res.status(500).json({ error: fallback });
}

// POST /api/students
async function create(req, res) {
  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Student.create(value));
  } catch (err) {
    handleWriteError(err, res, 'Failed to create student.');
  }
}

// GET /api/students/:id - the full profile in one response.
// Promise.all runs the independent queries at the same time.
async function profile(req, res) {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    const [activePackage, rankHistory, payments, gradings] = await Promise.all([
      Student.currentPackage(req.params.id),
      Student.rankHistory(req.params.id),
      Student.paymentHistory(req.params.id),
      Student.gradingHistory(req.params.id),
    ]);
    res.json({ student, package: activePackage, rankHistory, payments, gradings });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Student not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load student.' });
  }
}

// PUT /api/students/:id
async function update(req, res) {
  const { error, value } = editSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Student.update(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Student not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Student not found.' });
    handleWriteError(err, res, 'Failed to update student.');
  }
}

// POST /api/students/:id/rank - the only way a rank changes. req.adminId is set by requireAdmin.
async function updateRank(req, res) {
  const { error, value } = rankSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const result = await Student.changeRank(
      req.params.id,
      { rankId: value.rank_id, changedOn: value.changed_on, note: value.note, candidateId: value.candidate_id },
      req.adminId
    );
    if (result.status === 'NOT_FOUND') return res.status(404).json({ error: 'Student not found.' });
    if (result.status === 'SAME_RANK') return res.status(409).json({ error: 'Student already has this rank.' });
    res.json(result.student);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Student not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Rank not found.' });
    // 23505 here means this grading result was already used for a rank change.
    if (err.code === '23505') return res.status(409).json({ error: 'This grading result was already used for a rank change.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update rank.' });
  }
}

// Factory: returns a handler that deactivates (false) or activates (true) a student.
function setActive(isActive) {
  return async (req, res) => {
    try {
      if (!(await Student.setActive(req.params.id, isActive))) {
        return res.status(404).json({ error: 'Student not found.' });
      }
      res.json(await Student.findById(req.params.id));
    } catch (err) {
      if (err.code === '22P02') return res.status(404).json({ error: 'Student not found.' });
      console.error(err);
      res.status(500).json({ error: 'Failed to update student.' });
    }
  };
}

module.exports = { list, create, profile, update, updateRank, deactivate: setActive(false), activate: setActive(true) };
