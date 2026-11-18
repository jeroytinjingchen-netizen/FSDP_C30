// controllers/dashboardController.js - the admin dashboard in one response (AS-2).
const Dashboard = require('../model/dashboardModel');

// GET /api/dashboard?centreId=...
// req.centreId is set by the centreFilter middleware (null = all centres).
// Promise.all starts the three queries together and waits for all of them.
async function getDashboard(req, res) {
  try {
    const [totals, upcomingGradings, recentPayments] = await Promise.all([
      Dashboard.summary(req.centreId),
      Dashboard.upcomingGradings(req.centreId, 5),
      Dashboard.recentPayments(req.centreId, 5),
    ]);
    res.json({ totals, upcomingGradings, recentPayments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

module.exports = { getDashboard };
