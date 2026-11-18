// routes/student.js - student portal routes, mounted at /api/student.
// A route maps a URL and HTTP method to a controller function.
const express = require('express');
const student = require('../controllers/studentController');
const { requireStudent } = require('../middlewares/student');

const router = express.Router();
// Every route below needs a logged-in student.
router.use(requireStudent);

router.get('/me', student.getMe);
router.get('/rank', student.getMyRank);
router.get('/packages', student.listPackages);
router.post('/packages/:id/checkout', student.checkoutPackage);
router.get('/package', student.getMyPackage);
router.post('/attendance', student.recordAttendance);

module.exports = router;
