// routes/classes.js
const express = require('express');
const classes = require('../controllers/classController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/templates', classes.listTemplates);
router.post('/templates', classes.createTemplate);
router.put('/templates/:id', classes.updateTemplate);
router.delete('/templates/:id', classes.removeTemplate);
router.post('/templates/:id/generate', classes.generateSessions);

router.get('/sessions', centreFilter, classes.listSessions);
router.patch('/sessions/:id', classes.patchSession);
router.get('/conflicts', centreFilter, classes.checkConflicts);

module.exports = router;
