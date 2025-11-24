const express = require('express');
const router = express.Router();
const aiAssistantController = require('../controllers/aiAssistantController');

// Middleware to check if user is a mechanic (optional - can add auth check)
// router.use(require('../middleware/authMiddleware'));

// POST /api/ai-assistant/analyze
router.post('/analyze', aiAssistantController.analyzeJobRequest);

module.exports = router;

