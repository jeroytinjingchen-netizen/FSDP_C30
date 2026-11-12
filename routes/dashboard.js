// routes/dashboard.js
const express = require('express');
const dashboard = require('../controllers/dashboardController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/', centreFilter, dashboard.getDashboard);

module.exports = router;
