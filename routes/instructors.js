// routes/instructors.js
const express = require('express');
const instructors = require('../controllers/instructorController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/', centreFilter, instructors.list);
router.post('/', instructors.create);
router.put('/:id', instructors.update);
router.post('/:id/deactivate', instructors.deactivate);
router.post('/:id/activate', instructors.activate);
router.get('/:id/availability', instructors.getAvailability);
router.put('/:id/availability', instructors.putAvailability);

module.exports = router;
