// app.js - the Express server. It wires up middleware, API routes and the built React app.
// Express is the web framework: app.use(...) registers middleware and routers, app.listen(...) starts the server.

// dotenv loads variables from the .env file into process.env (database URL, Stripe keys, ...).
require('dotenv').config();
const express = require('express');
const path = require('path');

// Each routes file maps URLs to controller functions for one area of the app.
const authRoutes = require('./routes/auth');
const centreRoutes = require('./routes/centres');
const instructorRoutes = require('./routes/instructors');
const classRoutes = require('./routes/classes');
const gradingRoutes = require('./routes/grading');
const paymentRoutes = require('./routes/payments');
const lookupRoutes = require('./routes/lookups');
const dashboardRoutes = require('./routes/dashboard');
const studentRoutes = require('./routes/student');
const adminStudentRoutes = require('./routes/adminStudents');
const stripeController = require('./controllers/stripeController');

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook. Mounted before express.json() so the raw body is kept for signature checks.
// It is public (no admin session) because Stripe calls it. The signature is the only check.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeController.webhook);

// Middleware: turn JSON and form request bodies into req.body.
app.use(express.json({ limit: '1mb' })); // CSV uploads are sent as JSON text
app.use(express.urlencoded({ extended: true }));

// API routes. Admin areas first, then the student portal.
app.use('/api/auth', authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/students', adminStudentRoutes);

// Serve the built React app (public/dist) and fall back to index.html for client-side routes.
const clientDist = path.join(__dirname, 'public', 'dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
});

// Export for Vercel serverless
module.exports = app;

// Only start the server when running locally (not on Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
