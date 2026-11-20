// controllers/dashboardController.js - the admin dashboard in one response (AS-2).
const Dashboard = require('../model/dashboardModel');

// GET /api/dashboard?centreId=...
// req.centreId is set by the centreFilter middleware (null = all centres).
// Promise.all starts the queries together and waits for all of them.
// revenue.byCentre is only useful when every centre is shown; with one centre it would be a
// single 100% slice, so it is skipped (null).
async function getDashboard(req, res) {
  try {
    const [totals, upcomingGradings, recentPayments, byPackage, byCentre] = await Promise.all([
      Dashboard.summary(req.centreId),
      Dashboard.upcomingGradings(req.centreId, 5),
      Dashboard.recentPayments(req.centreId, 5),
      Dashboard.revenueBreakdown(req.centreId, 'package'),
      req.centreId ? null : Dashboard.revenueBreakdown(null, 'centre'),
    ]);
    res.json({ totals, upcomingGradings, recentPayments, revenue: { byPackage, byCentre } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

module.exports = { getDashboard };
