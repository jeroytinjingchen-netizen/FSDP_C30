// routes/instructors.js - URL map for instructors (AS-5). Mounted at /api/instructors in app.js.
// Assigning an instructor to a class (AS-6) lives in routes/classes.js.
const express = require('express');
const instructors = require('../controllers/instructorController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();

// Every route below needs a logged-in admin.
router.use(requireAdmin);

router.get('/', centreFilter, instructors.list);   // list; optional ?q=search&centreId=
router.post('/', instructors.create);               // add
router.put('/:id', instructors.update);             // edit
router.post('/:id/deactivate', instructors.deactivate);
router.post('/:id/activate', instructors.activate);

module.exports = router;
