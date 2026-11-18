// routes/lookups.js - read-only lists used by admin dropdowns (ranks, students), mounted at /api/lookups.
const express = require('express');
const pool = require('../dbConfig'); // shared Postgres connection pool
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin); // admins only

// GET /api/lookups/ranks - every rank, lowest first (rank_order), with the colour used for badges.
router.get('/ranks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, rank_order, colour FROM ranks ORDER BY rank_order');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load ranks.' });
  }
});

// GET /api/lookups/students - active students, optionally for one centre (?centreId=).
// centreFilter reads ?centreId and puts it on req.centreId.
router.get('/students', centreFilter, async (req, res) => {
  try {
    const params = [];
    let where = 'WHERE s.is_active = true';
    if (req.centreId) {
      // Values go in params and are referred to as $1, $2... so user input is never pasted into the SQL.
      params.push(req.centreId);
      where += ` AND s.centre_id = $${params.length}`;
    }
    // JOIN adds the rank name to each student row.
    const { rows } = await pool.query(
      `SELECT s.id, s.centre_id, s.first_name, s.last_name, s.current_rank_id,
              s.rank_since, r.name AS rank_name, r.rank_order
         FROM students s
         JOIN ranks r ON r.id = s.current_rank_id
         ${where}
        ORDER BY s.last_name, s.first_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load students.' });
  }
});

module.exports = router;
