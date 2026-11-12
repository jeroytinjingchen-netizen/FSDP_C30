// controllers/gradingController.js - grading sessions, registration with eligibility warnings, results (AS-16, AS-19, AS-22, AS-23)
const Joi = require('joi');
const PDFDocument = require('pdfkit');
const Grading = require('../model/gradingModel');

const uuid = () => Joi.string().guid({ version: 'uuidv4' });

const sessionSchema = Joi.object({
  centre_id: uuid().required(),
  venue_id: uuid().required(),
  type: Joi.string().valid('MASS', 'PRIVATE').required(),
  title: Joi.string().trim().max(150).allow('', null),
  starts_at: Joi.date().iso().required(),
  ends_at: Joi.date().iso().greater(Joi.ref('starts_at')).required(),
  notes: Joi.string().max(1000).allow('', null),
  rank_ids: Joi.array().items(uuid()).min(1).required(),
  examiner_ids: Joi.array().items(uuid()).min(1).required(),
});

const candidateSchema = Joi.object({ student_id: uuid().required() });

const resultSchema = Joi.object({
  outcome: Joi.string().valid('PASS', 'FAIL').required(),
  remarks: Joi.string().max(500).allow('', null),
});

// Minimum months a student should have held the current rank before grading. Stored in settings.
const DEFAULT_MIN_MONTHS_IN_RANK = 3;

async function list(req, res) {
  try {
    res.json(await Grading.listSessions(req.centreId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load grading sessions.' });
  }
}

async function create(req, res) {
  const { error, value } = sessionSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    res.status(201).json(await Grading.createSession(value));
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Centre, venue, rank or examiner not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create grading session.' });
  }
}

async function update(req, res) {
  const { error, value } = sessionSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const updated = await Grading.updateSession(req.params.id, value);
    if (!updated) return res.status(404).json({ error: 'Grading session not found.' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    if (err.code === '23503') return res.status(400).json({ error: 'Centre, venue, rank or examiner not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update grading session.' });
  }
}

async function remove(req, res) {
  try {
    if (!(await Grading.removeSession(req.params.id))) return res.status(404).json({ error: 'Grading session not found.' });
    res.json({ message: 'Grading session deleted.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    if (err.code === '23503') return res.status(409).json({ error: 'Cannot delete: candidates have results.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete grading session.' });
  }
}

// Each candidate row carries eligibility warnings. Registration is still allowed when the admin confirms.
async function listCandidates(req, res) {
  try {
    const session = await Grading.findSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Grading session not found.' });
    const minMonths = (await Grading.getSetting('minMonthsInRank')) ?? DEFAULT_MIN_MONTHS_IN_RANK;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - Number(minMonths));

    const rows = (await Grading.listCandidates(req.params.id)).map((c) => {
      const warnings = [];
      if (!c.is_active) warnings.push('Student is inactive');
      if (!c.rank_is_tested) warnings.push('Rank is not tested in this session');
      if (new Date(c.rank_since) > cutoff) warnings.push(`Less than ${minMonths} months in current rank`);
      return { ...c, warnings };
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load candidates.' });
  }
}

async function addCandidate(req, res) {
  const { error, value } = candidateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const id = await Grading.addCandidate(req.params.id, value.student_id);
    if (!id) return res.status(404).json({ error: 'Student not found.' });
    res.status(201).json({ id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Student is already registered for this session.' });
    if (err.code === '23503') return res.status(404).json({ error: 'Grading session not found.' });
    if (err.code === '22P02') return res.status(404).json({ error: 'Grading session not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to register candidate.' });
  }
}

async function removeCandidate(req, res) {
  try {
    if (!(await Grading.removeCandidate(req.params.candidateId))) {
      return res.status(409).json({ error: 'Candidate not found or already has a result.' });
    }
    res.json({ message: 'Candidate removed.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Candidate not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to remove candidate.' });
  }
}

async function recordResult(req, res) {
  const { error, value } = resultSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const result = await Grading.recordResult(req.params.candidateId, value);
    if (result.status === 'NOT_FOUND') return res.status(404).json({ error: 'Candidate not found.' });
    if (result.status === 'ALREADY_RECORDED') return res.status(409).json({ error: 'A result is already recorded.' });
    res.json(result);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Candidate not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to record result.' });
  }
}

async function promotions(req, res) {
  try {
    res.json(await Grading.listPromotions(req.params.studentId));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Student not found.' });
    console.error(err);
    res.status(500).json({ error: 'Failed to load promotion history.' });
  }
}

// Streams a printable PDF certificate for one promotion (AS-26).
async function certificate(req, res) {
  try {
    const row = await Grading.findPromotionCertificate(req.params.studentId, req.params.promotionId);
    if (!row) return res.status(404).json({ error: 'Promotion not found.' });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const name = `${row.first_name} ${row.last_name}`;
    const date = new Date(row.promoted_at).toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${row.id}.pdf"`);
    doc.pipe(res);

    doc.fontSize(14).fillColor('#7f1d1d').text('AIKIDO SHINJUKAI', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(34).fillColor('#111111').text('Certificate of Promotion', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(16).fillColor('#333333').text('This certifies that', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(28).text(name, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).text(`has been promoted from ${row.from_rank} to ${row.to_rank}`, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).text(`Centre: ${row.centre_name}`, { align: 'center' });
    doc.text(`Date: ${date}`, { align: 'center' });

    doc.end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Promotion not found.' });
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate certificate.' });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  listCandidates,
  addCandidate,
  removeCandidate,
  recordResult,
  promotions,
  certificate,
};
