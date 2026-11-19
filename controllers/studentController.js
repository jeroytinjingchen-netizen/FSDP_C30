// controllers/studentController.js - the minimal student portal.
// A student sees their own rank and package, buys a package, and records attendance.
// A controller reads the request, calls the model or service, and sends the response.
const portal = require('../model/studentPortalModel');
const { createCheckoutForPackage } = require('../services/stripeService');

// UUIDs are the id format used by the database. Checking the shape stops bad input early.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/student/me - the logged-in student's profile (set by the requireStudent middleware).
function getMe(req, res) {
  return res.json({ student: req.student });
}

// GET /api/student/rank - the student's current rank.
async function getMyRank(req, res, next) {
  try {
    const rank = await portal.getRank(req.student.id);
    if (!rank) return res.status(404).json({ error: 'Rank not found.' });
    res.json(rank);
  } catch (err) {
    next(err);
  }
}

// GET /api/student/packages - the packages on sale.
async function listPackages(req, res, next) {
  try {
    res.json(await portal.listPackages());
  } catch (err) {
    next(err);
  }
}

// POST /api/student/packages/:id/checkout - starts a Stripe test-mode payment for a package.
// The reply holds the Stripe URL the browser should open.
async function checkoutPackage(req, res, next) {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Package not found.' });
    const pkg = await portal.findPackage(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Package not found.' });
    const result = await createCheckoutForPackage(req.student, pkg);
    res.json({ url: result.url, sessionId: result.sessionId });
  } catch (err) {
    next(err);
  }
}

// GET /api/student/package - the student's current package with sessions used and remaining.
async function getMyPackage(req, res, next) {
  try {
    res.json({ package: await portal.getCurrentPackage(req.student.id) });
  } catch (err) {
    next(err);
  }
}

// POST /api/student/attendance - the student records attending a class today.
// Each attendance uses up one session of the package.
async function recordAttendance(req, res, next) {
  try {
    const result = await portal.recordAttendance(req.student.id);
    if (result.error === 'NO_ACTIVE_PACKAGE') {
      return res.status(400).json({ error: 'You have no active package with sessions left.' });
    }
    if (result.error === 'ALREADY_RECORDED') {
      return res.status(409).json({ error: 'Attendance is already recorded for today.' });
    }
    res.status(201).json({ package: await portal.getCurrentPackage(req.student.id) });
  } catch (err) {
    next(err);
  }
}

// GET /api/student/grading-history - the student's past gradings.
async function getGradingHistory(req, res, next) {
  try {
    res.json(await portal.getGradingHistory(req.student.id));
  } catch (err) {
    next(err);
  }
}

// GET /api/student/attendance-history - the student's recent attendance records.
async function getAttendanceHistory(req, res, next) {
  try {
    res.json(await portal.getAttendanceHistory(req.student.id));
  } catch (err) {
    next(err);
  }
}

// GET /api/student/schedule - the student's class schedule at their centre.
async function getClassSchedule(req, res, next) {
  try {
    res.json(await portal.getClassSchedule(req.student.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, getMyRank, listPackages, checkoutPackage, getMyPackage, recordAttendance, getGradingHistory, getAttendanceHistory, getClassSchedule };
