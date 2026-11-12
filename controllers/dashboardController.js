// controllers/dashboardController.js - admin dashboard aggregate (AS-44)
const Dashboard = require('../model/dashboardModel');

async function getDashboard(req, res) {
  try {
    const [totals, upcomingGradings, recentPayments, monthly] = await Promise.all([
      Dashboard.summary(req.centreId),
      Dashboard.upcomingGradings(req.centreId, 5),
      Dashboard.recentPayments(req.centreId, 5),
      Dashboard.monthlySeries(req.centreId, 6),
    ]);
    res.json({ totals, upcomingGradings, recentPayments, monthly });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

module.exports = { getDashboard };
