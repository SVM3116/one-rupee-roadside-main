const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const verifySupabase = require('../middleware/verifySupabase');
const requireAdminRole = require('../middleware/requireAdminRole');

// All routes require admin role
router.use(verifySupabase);
router.use(requireAdminRole);

// GET /api/admin/stats
router.get('/stats', controller.getStats);

// GET /api/admin/mechanics
router.get('/mechanics', controller.getMechanics);

// PUT /api/admin/mechanics/:mechanicId/verify
router.put('/mechanics/:mechanicId/verify', controller.verifyMechanic);

// GET /api/admin/requests
router.get('/requests', controller.getRequests);

// PUT /api/admin/requests/:requestId/assign
router.put('/requests/:requestId/assign', controller.assignMechanic);

// GET /api/admin/users
router.get('/users', controller.getUsers);

module.exports = router;

