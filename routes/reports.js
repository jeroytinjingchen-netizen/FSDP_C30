// routes/reports.js
const express = require('express');
const reports = require('../controllers/reportController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/financial', centreFilter, reports.financialReport);
router.get('/financial.csv', centreFilter, reports.financialReportCsv);

module.exports = router;
