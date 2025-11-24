const { supabase } = require('../utils/supabase');

/**
 * GET /api/chat/:requestId
 * Get chat messages for a request
 */
exports.getMessages = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user has access to this request
    const { data: request, error: requestError } = await supabase
      .from('job_requests')
      .select('user_id, mechanic_id')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.user_id !== userId && request.mechanic_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return res.json({ success: true, messages: messages || [] });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

/**
 * POST /api/chat/:requestId
 * Send a message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;
    const { message } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Verify user has access to this request
    const { data: request, error: requestError } = await supabase
      .from('job_requests')
      .select('user_id, mechanic_id')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.user_id !== userId && request.mechanic_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Determine sender type
    const senderType = request.user_id === userId ? 'user' : 'mechanic';

    // Insert message
    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        request_id: requestId,
        sender_id: userId,
        sender_type: senderType,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create notification for the other party
    const recipientId = request.user_id === userId ? request.mechanic_id : request.user_id;
    if (recipientId) {
      await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'message_received',
        title: 'New Message',
        message: `You have a new message about your service request`,
        data: { request_id: requestId },
      });
    }

    return res.status(201).json({ success: true, message: newMessage });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

/**
 * PUT /api/chat/:messageId/read
 * Mark message as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user has access to this message
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('request_id, sender_id, job_requests!inner(user_id, mechanic_id)')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const request = message.job_requests;
    if (request.user_id !== userId && request.mechanic_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only mark as read if user is not the sender
    if (message.sender_id === userId) {
      return res.json({ success: true, message: 'Message is from you' });
    }

    // Update read_at
    const { data: updated, error } = await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ success: true, message: updated });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

