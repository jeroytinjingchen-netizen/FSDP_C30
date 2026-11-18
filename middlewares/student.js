// middlewares/student.js - guards the student portal routes.
// Middleware is a function (req, res, next) that runs before a route. Calling next() lets the request continue.
const User = require('../model/userModel');
const { getSessionUserId } = require('./session');

// Matches the format of a database id (UUID), so a malformed cookie value never reaches the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads the signed session cookie, verifies an active STUDENT, and attaches their student profile as req.student.
async function requireStudent(req, res, next) {
  try {
    const id = getSessionUserId(req);
    if (!id || !UUID_RE.test(id)) return res.status(401).json({ error: 'Student login required.' }); // not logged in
    const user = await User.findAuthById(id);
    if (!user || !user.is_active || user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Student access required.' }); // logged in, but not as a student
    }
    const profile = await User.findStudentProfile(id);
    if (!profile) return res.status(403).json({ error: 'No student profile is linked to this account.' });
    req.student = profile; // controllers read the student from req.student
    next();
  } catch (err) {
    console.error('requireStudent error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { requireStudent };
