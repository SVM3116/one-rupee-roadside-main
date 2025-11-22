const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const verifySupabase = require('../middleware/verifySupabase');
const requireUserRole = require('../middleware/requireUserRole');

// All routes require authentication
router.use(verifySupabase);
router.use(requireUserRole);

// GET /api/user/profile
router.get('/profile', controller.getProfile);

// PUT /api/user/profile
router.put('/profile', controller.updateProfile);

// PUT /api/user/location
router.put('/location', controller.updateLocation);

module.exports = router;

