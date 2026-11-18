// routes/grading.js - URL map for grading sessions and results (AS-10, AS-11). Mounted at /api/grading.
const express = require('express');
const grading = require('../controllers/gradingController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();

// Every route below needs a logged-in admin.
router.use(requireAdmin);

// Grading sessions (mass events at HQ)
router.get('/sessions', centreFilter, grading.list);       // history; ?centreId= &rankId= &from= &to=
router.post('/sessions', grading.create);                    // create with a date
router.get('/sessions/:id', centreFilter, grading.detail);   // one session with its students and outcomes
router.put('/sessions/:id', grading.update);
router.delete('/sessions/:id', grading.remove);

// Results inside a session
router.post('/sessions/:id/results', grading.addResult);          // one result
router.post('/sessions/:id/results/upload', grading.uploadResults); // bulk CSV
router.put('/results/:resultId', grading.updateResult);
router.delete('/results/:resultId', grading.removeResult);

module.exports = router;
