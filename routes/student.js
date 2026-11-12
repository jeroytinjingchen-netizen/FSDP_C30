// routes/student.js
const express = require('express');
const student = require('../controllers/studentController');
const { requireStudent } = require('../middlewares/student');

const router = express.Router();
router.use(requireStudent);

router.get('/me', student.getMe);
router.get('/invoices', student.listMyInvoices);
router.post('/invoices/:id/checkout', student.checkoutMyInvoice);
router.get('/belt', student.getMyBelt);
router.get('/timetable', student.listMyTimetable);
router.patch('/profile', student.updateMyContact);
router.get('/invoices/:id/payments', student.listMyInvoicePayments);

module.exports = router;
