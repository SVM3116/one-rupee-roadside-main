const express = require('express');
const router = express.Router();
const controller = require('../controllers/ratingController');
const verifySupabase = require('../middleware/verifySupabase');
const requireUserRole = require('../middleware/requireUserRole');

// POST /api/ratings - Create rating (user)
router.post('/', verifySupabase, requireUserRole, controller.createRating);

// GET /api/ratings/mechanic/:mechanicId - Get mechanic ratings (public)
router.get('/mechanic/:mechanicId', controller.getMechanicRatings);

// GET /api/ratings/user - Get user's ratings
router.get('/user', verifySupabase, requireUserRole, controller.getUserRatings);

// PUT /api/ratings/:ratingId - Update rating (user)
router.put('/:ratingId', verifySupabase, requireUserRole, controller.updateRating);

module.exports = router;

