const express = require('express');
const router = express.Router();
const earningsController = require('../controllers/earningsController');
const verifySupabase = require('../middleware/verifySupabase');
const requireMechanicRole = require('../middleware/requireMechanicRole');
const requireAdminRole = require('../middleware/requireAdminRole');

// GET /api/earnings - Get mechanic's earnings (mechanic)
router.get('/', verifySupabase, requireMechanicRole, earningsController.getEarnings);

// GET /api/earnings/stats - Get earnings statistics (mechanic)
router.get('/stats', verifySupabase, requireMechanicRole, earningsController.getEarningsStats);

// GET /api/earnings/transactions - Get transaction history (mechanic)
router.get('/transactions', verifySupabase, requireMechanicRole, earningsController.getTransactions);

// GET /api/earnings/admin/summary - Get all earnings summary (admin)
router.get('/admin/summary', verifySupabase, requireAdminRole, earningsController.getAdminSummary);

module.exports = router;

