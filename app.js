// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const centreRoutes = require('./routes/centres');
const venueRoutes = require('./routes/venues');
const termRoutes = require('./routes/terms');
const instructorRoutes = require('./routes/instructors');
const classRoutes = require('./routes/classes');
const gradingRoutes = require('./routes/grading');
const billingRoutes = require('./routes/billing');
const lookupRoutes = require('./routes/lookups');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const studentRoutes = require('./routes/student');
const { runReminders } = require('./services/reminderService');
const stripeController = require('./controllers/stripeController');

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook. Mounted before express.json() so the raw body is kept for signature checks.
// It is public (no admin session) because Stripe calls it. The signature is the only check.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeController.webhook);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/student', studentRoutes);

// Serve the built React app (public/dist) and fall back to index.html for client-side routes
const clientDist = path.join(__dirname, 'public', 'dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Daily reminder job. Dedupe keys in notification_log make repeated runs safe.
// Set REMINDER_JOB=off to disable the timer and use the manual run endpoint only.
if (process.env.REMINDER_JOB !== 'off') {
  const DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runReminders().catch((err) => console.error('Reminder job failed:', err.message));
  }, DAY_MS).unref();
}
