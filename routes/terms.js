// routes/terms.js
const express = require('express');
const terms = require('../controllers/termController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

const router = express.Router();
router.use(requireAdmin);

router.get('/', centreFilter, terms.list);
router.post('/', terms.create);
router.put('/:id', terms.update);
router.delete('/:id', terms.remove);

module.exports = router;
