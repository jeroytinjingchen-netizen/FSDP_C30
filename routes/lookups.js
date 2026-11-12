// routes/lookups.js - read-only lists used by admin dropdowns (ranks, students)
const express = require('express');
const pool = require('../dbConfig');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/ranks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, rank_order, colour FROM ranks ORDER BY rank_order');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load ranks.' });
  }
});

router.get('/students', centreFilter, async (req, res) => {
  try {
    const params = [];
    let where = 'WHERE s.is_active = true';
    if (req.centreId) {
      params.push(req.centreId);
      where += ` AND s.centre_id = $${params.length}`;
    }
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
