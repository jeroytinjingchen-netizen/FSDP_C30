// routes/centres.js - centre routes, mounted at /api/centres.
// A route maps a URL and HTTP method to a controller function.
const express = require('express');
const centres = require('../controllers/centreController');
const { requireAdmin } = require('../middlewares/admin');

// express.Router() groups related routes so app.js can mount them under one path.
const router = express.Router();
// router.use runs requireAdmin before every route below, so logged-out users get a 401 error.
router.use(requireAdmin);

router.get('/', centres.list); // list centres with their schedule
router.post('/', centres.create); // add a centre
router.put('/:id', centres.update); // edit a centre (":id" is the centre's id in the URL)
router.post('/:id/archive', centres.archive); // hide a centre without deleting it
router.post('/:id/restore', centres.restore); // bring an archived centre back
router.delete('/:id', centres.remove); // delete; refused when the centre has students

module.exports = router;
