// routes/grading.js
const express = require('express');
const grading = require('../controllers/gradingController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/sessions', centreFilter, grading.list);
router.post('/sessions', grading.create);
router.put('/sessions/:id', grading.update);
router.delete('/sessions/:id', grading.remove);
router.get('/sessions/:id/candidates', grading.listCandidates);
router.post('/sessions/:id/candidates', grading.addCandidate);
router.delete('/candidates/:candidateId', grading.removeCandidate);
router.post('/candidates/:candidateId/result', grading.recordResult);
router.get('/students/:studentId/promotions', grading.promotions);
router.get('/students/:studentId/promotions/:promotionId/certificate', grading.certificate);

module.exports = router;
