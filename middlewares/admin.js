// middlewares/admin.js
const User = require('../model/userModel');
const { getSessionUserId } = require('./session');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads the signed session cookie and verifies the user is an active ADMIN.
async function requireAdmin(req, res, next) {
  try {
    const id = getSessionUserId(req);
    if (!id || !UUID_RE.test(id)) return res.status(401).json({ error: 'Admin login required.' });
    const user = await User.findAuthById(id);
    if (!user || !user.is_active || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    req.adminId = id;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// Reads ?centreId= (blank/"all" = all centres). Use req.centreId in any list/dashboard query:
//   WHERE ($1::uuid IS NULL OR centre_id = $1)
function centreFilter(req, res, next) {
  const raw = req.query.centreId;
  if (!raw || raw === 'all') {
    req.centreId = null;
  } else if (UUID_RE.test(raw)) {
    req.centreId = raw;
  } else {
    return res.status(400).json({ error: 'Invalid centreId.' });
  }
  next();
}

module.exports = { requireAdmin, centreFilter };
