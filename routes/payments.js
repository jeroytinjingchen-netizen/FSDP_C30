// routes/payments.js - admin payments (AS-12, AS-13)
// Only GET routes exist on purpose: admins view and export payments but never create, edit or delete them.
const express = require('express');
const payments = require('../controllers/paymentController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
// Every route below needs a logged-in admin.
router.use(requireAdmin);

router.get('/', centreFilter, payments.listPayments);
router.get('/export.csv', centreFilter, payments.exportPaymentsCsv);

module.exports = router;
