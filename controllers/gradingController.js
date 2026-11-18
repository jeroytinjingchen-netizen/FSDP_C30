// controllers/gradingController.js - HTTP handlers for grading sessions and results (AS-10, AS-11).
//
// A controller validates the request, calls the model, and writes the response.
// Joi is a validation library: schema.validate(data) returns { error, value }.
const Joi = require('joi');
const Grading = require('../model/gradingModel');
const { parseCsv } = require('../utils/csv');

const uuid = () => Joi.string().guid({ version: 'uuidv4' });

// A grading session is a dated event at HQ. The centre is not sent by the client: it is always HQ.
const sessionSchema = Joi.object({
  title: Joi.string().trim().max(150).allow('', null),
  starts_at: Joi.date().iso().required(),
  ends_at: Joi.date().iso().greater(Joi.ref('starts_at')).required(),
  notes: Joi.string().max(1000).allow('', null),
});

// One result. The student's centre comes from the student record, so it is not sent either.
const resultSchema = Joi.object({
  student_id: uuid().required(),
  graded_for_rank_id: uuid().required(),
  instructor_id: uuid().required(),
  outcome: Joi.string().valid('GRADED', 'NOT_GRADED').required(),
  remarks: Joi.string().max(500).allow('', null),
});
// When editing, the student is fixed, so student_id is not allowed.
const resultEditSchema = resultSchema.fork('student_id', (field) => field.forbidden());

// Reads ?rankId= safely: a non-empty string or null.
const queryId = (v) => (typeof v === 'string' && v ? v : null);

// Turns ?from= and ?to= (YYYY-MM-DD, Singapore time) into Date bounds. Either may be missing.
// "end" is the start of the day after "to", so the whole last day is included.
function dateBounds(query) {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const start = day.test(query.from || '') ? new Date(`${query.from}T00:00:00+08:00`) : null;
  let end = null;
  if (day.test(query.to || '')) {
    end = new Date(`${query.to}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
  }
  return { start, end };
}

// GET /api/grading/sessions?centreId=&rankId=&from=&to=  - grading history, newest first (AS-11).
// req.centreId is set by the centreFilter middleware.
async function list(req, res) {
  try {
    const { start, end } = dateBounds(req.query);
    res.json(await Grading.listSessions({ centreId: req.centreId, rankId: queryId(req.query.rankId), start, end }));
  } catch (err) {
    // 22P02 = a filter value was not a valid UUID.
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid filter value.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load grading sessions.' });
  }
}

// GET /api/grading/sessions/:id - the session with its students and outcomes (AS-11).
async function detail(req, res) {
  try {
    const session = await Grading.findSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Grading session not found.' });
    const results = await Grading.listResults(req.params.id, { centreId: req.centreId, rankId: queryId(req.query.rankId) });
    res.json({ session, results });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load grading session.' });
  }
}

// POST /api/grading/sessions
async function create(req, res) {
  const { error, value } = sessionSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const centreId = await Grading.findHqCentreId();
    if (!centreId) return res.status(409).json({ error: 'No HQ centre is set up. Gradings are held at HQ.' });
    res.status(201).json(
      await Grading.createSession({ centreId, title: value.title, startsAt: value.starts_at, endsAt: value.ends_at, notes: value.notes })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create grading session.' });
  }
}

// PUT /api/grading/sessions/:id
async function update(req, res) {
  const { error, value } = sessionSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Grading.updateSession(req.params.id, {
      title: value.title, startsAt: value.starts_at, endsAt: value.ends_at, notes: value.notes,
    });
    if (!updated) return res.status(404).json({ error: 'Grading session not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update grading session.' });
  }
}

// DELETE /api/grading/sessions/:id - only allowed while the session has no results.
async function remove(req, res) {
  try {
    const status = await Grading.removeSession(req.params.id);
    if (status === 'NOT_FOUND') return res.status(404).json({ error: 'Grading session not found.' });
    if (status === 'HAS_RESULTS') return res.status(409).json({ error: 'Cannot delete: this grading already has results.' });
    res.json({ message: 'Grading session deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete grading session.' });
  }
}

// POST /api/grading/sessions/:id/results - add one result (AS-10).
// The response includes student_id so the page can link to that student's rank update (AS-8).
async function addResult(req, res) {
  const { error, value } = resultSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const row = await Grading.addResult(req.params.id, {
      studentId: value.student_id, gradedForRankId: value.graded_for_rank_id,
      instructorId: value.instructor_id, outcome: value.outcome, remarks: value.remarks,
    });
    if (!row) return res.status(404).json({ error: 'Student not found.' });
    res.status(201).json(row);
  } catch (err) {
    // 23505 = unique violation: the student already has a result in this grading.
    if (err.code === '23505') return res.status(409).json({ error: 'This student already has a result in this grading.' });
    // 23503 = foreign key violation: the grading, rank or instructor does not exist.
    if (err.code === '23503' || err.code === '22P02') return res.status(404).json({ error: 'Grading, rank or instructor not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to save result.' });
  }
}

// PUT /api/grading/results/:resultId
async function updateResult(req, res) {
  const { error, value } = resultEditSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const row = await Grading.updateResult(req.params.resultId, {
      gradedForRankId: value.graded_for_rank_id, instructorId: value.instructor_id,
      outcome: value.outcome, remarks: value.remarks,
    });
    if (!row) return res.status(404).json({ error: 'Result not found.' });
    res.json(row);
  } catch (err) {
    if (err.code === '23503' || err.code === '22P02') return res.status(404).json({ error: 'Result, rank or instructor not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update result.' });
  }
}

// DELETE /api/grading/results/:resultId
async function removeResult(req, res) {
  try {
    if (!(await Grading.removeResult(req.params.resultId))) return res.status(404).json({ error: 'Result not found.' });
    res.json({ message: 'Result deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Result not found.' });
    if (err.code === '23503') return res.status(409).json({ error: 'Cannot delete: a rank change is linked to this result.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete result.' });
  }
}

// Reads an outcome typed in a CSV ("Graded", "Not graded", "not_graded") into GRADED / NOT_GRADED.
function parseOutcome(text) {
  const t = String(text || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return t;
}

// POST /api/grading/sessions/:id/results/upload  body: { csv: "<file text>" } (AS-10).
// Required header columns: student_email, rank_graded_for, outcome, grading_instructor. Optional: remarks.
async function uploadResults(req, res) {
  const csv = req.body && req.body.csv;
  if (typeof csv !== 'string' || !csv.trim()) return res.status(400).json({ error: 'CSV text is required.' });
  const table = parseCsv(csv);
  if (table.length < 2) return res.status(400).json({ error: 'The CSV needs a header row and at least one data row.' });
  if (table.length > 1001) return res.status(400).json({ error: 'The CSV can have at most 1000 rows.' });

  // Header names are matched case-insensitively and may be in any order.
  const header = table[0].map((h) => h.trim().toLowerCase());
  const required = ['student_email', 'rank_graded_for', 'outcome', 'grading_instructor'];
  const missing = required.filter((name) => !header.includes(name));
  if (missing.length) return res.status(400).json({ error: `Missing column(s): ${missing.join(', ')}.` });
  const col = (row, name) => (row[header.indexOf(name)] || '').trim();

  // line is the spreadsheet row number (header is line 1).
  const records = table.slice(1).map((row, i) => ({
    line: i + 2,
    email: col(row, 'student_email'),
    rank: col(row, 'rank_graded_for'),
    outcome: parseOutcome(col(row, 'outcome')),
    instructor: col(row, 'grading_instructor'),
    remarks: header.includes('remarks') ? col(row, 'remarks') : '',
  }));

  try {
    if (!(await Grading.findSession(req.params.id))) return res.status(404).json({ error: 'Grading session not found.' });
    const result = await Grading.bulkAddResults(req.params.id, records);
    if (result.errors) return res.status(422).json({ error: 'Nothing was saved. Fix these rows and upload again.', errors: result.errors });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to upload results.' });
  }
}

module.exports = { list, detail, create, update, remove, addResult, updateResult, removeResult, uploadResults };
