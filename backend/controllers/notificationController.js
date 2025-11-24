const { supabase } = require('../utils/supabase');

/**
 * GET /api/notifications
 * Get user's notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = 50, unread_only } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (unread_only === 'true') {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({ success: true, notifications: notifications || [] });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
};

/**
 * GET /api/notifications/unread
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw error;
    }

    return res.json({ success: true, count: count || 0 });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    return res.status(500).json({ error: 'Failed to get unread count', details: err.message });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify ownership
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: updated, error } = await supabase
      .from('notifications')
      .update({ 
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ success: true, notification: updated });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ 
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    return res.status(500).json({ error: 'Failed to mark all notifications as read', details: err.message });
  }
};

