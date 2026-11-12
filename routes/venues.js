// routes/venues.js
const express = require('express');
const venues = require('../controllers/venueController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/', centreFilter, venues.list);
router.post('/', venues.create);
router.put('/:id', venues.update);
router.post('/:id/archive', venues.archive);
router.post('/:id/restore', venues.restore);
router.delete('/:id', venues.remove);

module.exports = router;
