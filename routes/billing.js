// routes/billing.js
const express = require('express');
const billing = require('../controllers/billingController');
const { createCheckout } = require('../controllers/stripeController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/fees', centreFilter, billing.listFeeItems);
router.post('/fees', billing.createFeeItem);
router.post('/fees/:id/generate', billing.generateInvoices);

router.get('/invoices', centreFilter, billing.listInvoices);
router.get('/invoices/:id', billing.getInvoice);
router.post('/invoices/:id/payments', billing.recordPayment);
router.post('/invoices/:id/checkout', createCheckout);

router.get('/summary', centreFilter, billing.summary);

module.exports = router;
