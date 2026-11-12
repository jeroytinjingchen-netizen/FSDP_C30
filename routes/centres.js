// routes/centres.js
const express = require('express');
const centres = require('../controllers/centreController');
const { requireAdmin } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/', centres.list);
router.post('/', centres.create);
router.put('/:id', centres.update);
router.post('/:id/archive', centres.archive);
router.post('/:id/restore', centres.restore);
router.delete('/:id', centres.remove);

module.exports = router;
