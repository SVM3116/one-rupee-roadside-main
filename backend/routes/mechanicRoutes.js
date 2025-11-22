const express = require('express');
const router = express.Router();
const controller = require('../controllers/mechanicController');
const verifySupabase = require('../middleware/verifySupabase');
const requireMechanicRole = require('../middleware/requireMechanicRole');

// POST toggle online status (requires auth)
router.post('/toggle-online', verifySupabase, requireMechanicRole, controller.toggleOnline);

// GET online status by id (public)
router.get('/online-status/:id', controller.getOnlineStatus);

// GET current user's online status (requires auth)
router.get('/online-status', verifySupabase, controller.getOnlineStatus);

// PUT update location (requires auth)
router.put('/location', verifySupabase, requireMechanicRole, controller.updateLocation);

// GET find nearby mechanics (public)
router.get('/nearby', controller.findNearby);

// GET mechanic's requests (requires auth)
router.get('/requests', verifySupabase, requireMechanicRole, controller.getRequests);

// GET ping
router.get('/ping', controller.ping);

module.exports = router;
