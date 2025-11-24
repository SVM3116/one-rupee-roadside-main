const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const verifySupabase = require('../middleware/verifySupabase');

// GET /api/notifications - Get user's notifications
router.get('/', verifySupabase, notificationController.getNotifications);

// GET /api/notifications/unread - Get unread count
router.get('/unread', verifySupabase, notificationController.getUnreadCount);

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', verifySupabase, notificationController.markAsRead);

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', verifySupabase, notificationController.markAllAsRead);

module.exports = router;

