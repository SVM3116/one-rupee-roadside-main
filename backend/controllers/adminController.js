const { supabase } = require('../utils/supabase');

/**
 * GET /api/admin/stats
 * Get system statistics
 */
exports.getStats = async (req, res) => {
  try {
    // Count users
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user');

    // Count mechanics
    const { count: mechanicCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'mechanic');

    // Count requests
    const { count: requestCount } = await supabase
      .from('job_requests')
      .select('*', { count: 'exact', head: true });

    // Count completed requests
    const { count: completedCount } = await supabase
      .from('job_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Count pending requests
    const { count: pendingCount } = await supabase
      .from('job_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Count ratings and calculate average
    const { count: ratingCount, data: ratings } = await supabase
      .from('testimonials')
      .select('rating');

    let averageRating = 0;
    if (ratings && ratings.length > 0) {
      const total = ratings.reduce((sum, r) => sum + (r.rating || 0), 0);
      averageRating = Math.round((total / ratings.length) * 10) / 10;
    }

    const stats = {
      users: userCount || 0,
      mechanics: mechanicCount || 0,
      requests: requestCount || 0,
      completedRequests: completedCount || 0,
      pendingRequests: pendingCount || 0,
      ratings: ratingCount || 0,
      averageRating,
    };

    return res.json({ success: true, stats });
  } catch (err) {
    console.error('getStats error', err);
    return res.status(500).json({ error: 'Failed to get statistics', details: err.message });
  }
};

/**
 * GET /api/admin/mechanics
 * Get all mechanics with filters
 */
exports.getMechanics = async (req, res) => {
  try {
    const { verificationStatus, isOnline, limit = 100 } = req.query;

    let query = supabase
      .from('profiles')
      .select('*')
      .eq('role', 'mechanic')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (verificationStatus) {
      query = query.eq('verification_status', verificationStatus);
    }
    if (isOnline !== undefined) {
      const status = isOnline === 'true' ? 'online' : 'offline';
      query = query.eq('availability_status', status);
    }

    const { data: mechanics, error } = await query;

    if (error) {
      throw error;
    }

    // Format response
    const formattedMechanics = (mechanics || []).map(m => ({
      uid: m.id,
      fullName: m.full_name,
      email: m.email,
      phone: m.phone,
      isOnline: m.availability_status === 'online',
      availabilityStatus: m.availability_status,
      verificationStatus: m.verification_status,
      services: m.services || [],
      workLocation: m.work_location,
      pincode: m.pincode,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    return res.json({ success: true, mechanics: formattedMechanics });
  } catch (err) {
    console.error('getMechanics error', err);
    return res.status(500).json({ error: 'Failed to get mechanics', details: err.message });
  }
};

/**
 * PUT /api/admin/mechanics/:mechanicId/verify
 * Approve or reject mechanic verification
 */
exports.verifyMechanic = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const { action, reason } = req.body;
    const adminId = req.user?.id;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    if (action === 'reject' && !reason) {
      return res.status(400).json({ error: 'Reason is required for rejection' });
    }

    const verificationStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update mechanic profile
    const { data: mechanic, error } = await supabase
      .from('profiles')
      .update({
        verification_status: verificationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mechanicId)
      .eq('role', 'mechanic')
      .select()
      .single();

    if (error || !mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    // Create verification log
    await supabase.from('mechanic_verification_logs').insert({
      mechanic_id: mechanicId,
      admin_id: adminId,
      action: action === 'approve' ? 'approved' : 'rejected',
      reason: reason || null,
    });

    // Create notification for mechanic
    await supabase.from('notifications').insert({
      user_id: mechanicId,
      type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
      title: action === 'approve' ? 'Verification Approved' : 'Verification Rejected',
      message: action === 'approve'
        ? 'Your mechanic account has been verified and approved.'
        : `Your mechanic account verification has been rejected. Reason: ${reason}`,
      data: { action, reason },
    });

    return res.json({
      success: true,
      mechanic: {
        uid: mechanic.id,
        verificationStatus: mechanic.verification_status,
      },
      message: `Mechanic ${action}d successfully`,
    });
  } catch (err) {
    console.error('verifyMechanic error', err);
    return res.status(500).json({ error: 'Failed to verify mechanic', details: err.message });
  }
};

/**
 * GET /api/admin/requests
 * Get all requests with filters
 */
exports.getRequests = async (req, res) => {
  try {
    const { status, limit = 100, start_date, end_date, user_id, mechanic_id } = req.query;

    let query = supabase
      .from('job_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (mechanic_id) {
      query = query.eq('mechanic_id', mechanic_id);
    }
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: requests, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({ success: true, requests: requests || [] });
  } catch (err) {
    console.error('getRequests error', err);
    return res.status(500).json({ error: 'Failed to get requests', details: err.message });
  }
};

/**
 * PUT /api/admin/requests/:requestId/assign
 * Manually assign a mechanic to a request
 */
exports.assignMechanic = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { mechanicId } = req.body;

    if (!mechanicId) {
      return res.status(400).json({ error: 'Mechanic ID is required' });
    }

    const { data: request, error } = await supabase
      .from('job_requests')
      .update({
        mechanic_id: mechanicId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Create notification for mechanic
    await supabase.from('notifications').insert({
      user_id: mechanicId,
      type: 'mechanic_assigned',
      title: 'New Job Assigned',
      message: `You have been assigned a new service request`,
      data: { request_id: requestId },
    });

    return res.json({
      success: true,
      request,
      message: 'Mechanic assigned successfully',
    });
  } catch (err) {
    console.error('assignMechanic error', err);
    return res.status(500).json({ error: 'Failed to assign mechanic', details: err.message });
  }
};

/**
 * GET /api/admin/users
 * Get all users
 */
exports.getUsers = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    // Format response
    const formattedUsers = (users || []).map(u => ({
      uid: u.id,
      email: u.email,
      fullName: u.full_name,
      phone: u.phone,
      status: u.status,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));

    return res.json({ success: true, users: formattedUsers });
  } catch (err) {
    console.error('getUsers error', err);
    return res.status(500).json({ error: 'Failed to get users', details: err.message });
  }
};
