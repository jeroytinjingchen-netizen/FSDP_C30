// routes/adminStudents.js - URL map for student management (AS-7, AS-8, AS-9). Mounted at /api/students.
const express = require('express');
const students = require('../controllers/adminStudentController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();

// Every route below needs a logged-in admin.
router.use(requireAdmin);

router.get('/', centreFilter, students.list);            // list; ?q=name/email &centreId= &rankId=
router.post('/', students.create);                        // add
router.get('/:id', students.profile);                     // profile with package, ranks, payments, gradings
router.put('/:id', students.update);                      // edit details (does NOT change rank)
router.post('/:id/rank', students.updateRank);            // manual rank update, logged with a date
router.post('/:id/deactivate', students.deactivate);
router.post('/:id/activate', students.activate);

module.exports = router;
