const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const verifySupabase = require('../middleware/verifySupabase');

// GET /api/chat/:requestId - Get chat messages for a request
router.get('/:requestId', verifySupabase, chatController.getMessages);

// POST /api/chat/:requestId - Send a message
router.post('/:requestId', verifySupabase, chatController.sendMessage);

// PUT /api/chat/:messageId/read - Mark message as read
router.put('/:messageId/read', verifySupabase, chatController.markAsRead);

module.exports = router;

