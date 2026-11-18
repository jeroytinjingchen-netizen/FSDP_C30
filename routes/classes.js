// routes/classes.js - URL map for classes (AS-4) and instructor assignment (AS-6).
// Mounted at /api/classes in app.js.
const express = require('express');
const classes = require('../controllers/classController');
const { requireAdmin, centreFilter } = require('../middlewares/admin');

// A Router is a mini Express app that groups related routes.
const router = express.Router();

// router.use(fn) runs fn for every route below it: only logged-in admins get through.
router.use(requireAdmin);

router.get('/', centreFilter, classes.list);          // list, optional ?centreId=
router.post('/', classes.create);                      // create
router.put('/:id', classes.update);                    // edit
router.delete('/:id', classes.remove);                 // remove
router.put('/:id/instructor', classes.assignInstructor); // assign / reassign / remove instructor

module.exports = router;
