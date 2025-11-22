const express = require('express');
const router = express.Router();
const controller = require('../controllers/requestController');
const verifySupabase = require('../middleware/verifySupabase');
const requireUserRole = require('../middleware/requireUserRole');
const requireMechanicRole = require('../middleware/requireMechanicRole');

// POST /api/requests - Create request (user)
router.post('/', verifySupabase, requireUserRole, controller.createRequest);

// GET /api/requests - Get user's requests
router.get('/', verifySupabase, requireUserRole, controller.getUserRequests);

// GET /api/requests/:requestId - Get specific request
router.get('/:requestId', verifySupabase, controller.getRequest);

// PUT /api/requests/:requestId/accept - Accept request (mechanic)
router.put('/:requestId/accept', verifySupabase, requireMechanicRole, controller.acceptRequest);

// PUT /api/requests/:requestId/reject - Reject request (mechanic)
router.put('/:requestId/reject', verifySupabase, requireMechanicRole, controller.rejectRequest);

// PUT /api/requests/:requestId/status - Update status (user or mechanic)
router.put('/:requestId/status', verifySupabase, controller.updateStatus);

module.exports = router;

