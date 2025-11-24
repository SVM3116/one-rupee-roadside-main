const { supabase } = require('../utils/supabase');
const { calculateDistance } = require('../utils/distance');

/**
 * POST /api/requests
 * Create a new service request
 */
exports.createRequest = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { vehicle_type, issue_description, user_location, media_urls } = req.body;

    if (!user_location || !user_location.lat || !user_location.lng) {
      return res.status(400).json({ error: 'User location is required' });
    }

    if (!vehicle_type || !issue_description) {
      return res.status(400).json({ error: 'Vehicle type and issue description are required' });
    }

    // Create request in Supabase
    const { data: newRequest, error } = await supabase
      .from('job_requests')
      .insert({
        user_id: uid,
        vehicle_type,
        issue_description,
        user_location: {
          lat: Number(user_location.lat),
          lng: Number(user_location.lng),
        },
        media_urls: media_urls || [],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Try to find and assign nearest mechanic
    try {
      const assignedMechanic = await findAndAssignMechanic(user_location.lat, user_location.lng);
      if (assignedMechanic) {
        const { error: updateError } = await supabase
          .from('job_requests')
          .update({ 
            mechanic_id: assignedMechanic.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', newRequest.id);

        if (!updateError) {
          newRequest.mechanic_id = assignedMechanic.id;

          // Create notification for mechanic
          await supabase.from('notifications').insert({
            user_id: assignedMechanic.id,
            type: 'mechanic_assigned',
            title: 'New Job Assigned',
            message: `You have been assigned a new service request`,
            data: { request_id: newRequest.id },
          });

          // Create notification for user
          await supabase.from('notifications').insert({
            user_id: uid,
            type: 'mechanic_assigned',
            title: 'Mechanic Assigned',
            message: `A mechanic has been assigned to your request`,
            data: { request_id: newRequest.id, mechanic_id: assignedMechanic.id },
          });
        }
      }
    } catch (assignErr) {
      console.warn('Failed to auto-assign mechanic:', assignErr);
    }

    return res.status(201).json({ success: true, request: newRequest });
  } catch (err) {
    console.error('createRequest error', err);
    return res.status(500).json({ error: 'Failed to create request', details: err.message });
  }
};

/**
 * GET /api/requests
 * Get user's requests
 */
exports.getUserRequests = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { status, limit = 50 } = req.query;

    let query = supabase
      .from('job_requests')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({ success: true, requests: requests || [] });
  } catch (err) {
    console.error('getUserRequests error', err);
    return res.status(500).json({ error: 'Failed to get requests', details: err.message });
  }
};

/**
 * GET /api/requests/:requestId
 * Get a specific request
 */
exports.getRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { data: request, error } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user has access
    if (request.user_id !== uid && request.mechanic_id !== uid) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error('getRequest error', err);
    return res.status(500).json({ error: 'Failed to get request', details: err.message });
  }
};

/**
 * PUT /api/requests/:requestId/accept
 * Mechanic accepts a request
 */
exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { data: request, error: fetchError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.mechanic_id !== uid) {
      return res.status(403).json({ error: 'You are not assigned to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not in pending status' });
    }

    const { data: updatedRequest, error } = await supabase
      .from('job_requests')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create notification for user
    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'request_accepted',
      title: 'Request Accepted',
      message: `Your service request has been accepted by the mechanic`,
      data: { request_id: requestId },
    });

    return res.json({ success: true, request: updatedRequest });
  } catch (err) {
    console.error('acceptRequest error', err);
    return res.status(500).json({ error: 'Failed to accept request', details: err.message });
  }
};

/**
 * PUT /api/requests/:requestId/reject
 * Mechanic rejects a request
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { data: request, error: fetchError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.mechanic_id !== uid) {
      return res.status(403).json({ error: 'You are not assigned to this request' });
    }

    // Update request to remove mechanic
    const { data: updatedRequest, error } = await supabase
      .from('job_requests')
      .update({ 
        mechanic_id: null,
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create notification for user
    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'request_rejected',
      title: 'Request Rejected',
      message: `The mechanic has rejected your service request. We'll assign another mechanic.`,
      data: { request_id: requestId },
    });

    // Try to reassign to another mechanic
    let reassigned = false;
    try {
      const userLocation = request.user_location;
      if (userLocation && userLocation.lat && userLocation.lng) {
        const assignedMechanic = await findAndAssignMechanic(userLocation.lat, userLocation.lng, uid);
        if (assignedMechanic) {
          await supabase
            .from('job_requests')
            .update({ 
              mechanic_id: assignedMechanic.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

          updatedRequest.mechanic_id = assignedMechanic.id;
          reassigned = true;

          // Create notifications
          await supabase.from('notifications').insert({
            user_id: assignedMechanic.id,
            type: 'mechanic_assigned',
            title: 'New Job Assigned',
            message: `You have been assigned a new service request`,
            data: { request_id: requestId },
          });

          await supabase.from('notifications').insert({
            user_id: request.user_id,
            type: 'mechanic_assigned',
            title: 'New Mechanic Assigned',
            message: `A new mechanic has been assigned to your request`,
            data: { request_id: requestId, mechanic_id: assignedMechanic.id },
          });
        }
      }
    } catch (assignErr) {
      console.warn('Failed to reassign mechanic:', assignErr);
    }

    return res.json({ success: true, request: updatedRequest, reassigned });
  } catch (err) {
    console.error('rejectRequest error', err);
    return res.status(500).json({ error: 'Failed to reject request', details: err.message });
  }
};

/**
 * PUT /api/requests/:requestId/status
 * Update request status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const validStatuses = ['pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: request, error: fetchError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check permissions
    if (request.user_id !== uid && request.mechanic_id !== uid) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const updateData = { 
      status, 
      updated_at: new Date().toISOString()
    };

    const { data: updatedRequest, error } = await supabase
      .from('job_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create notifications based on status
    let notificationType = null;
    let notificationTitle = '';
    let notificationMessage = '';

    switch (status) {
      case 'on_the_way':
        notificationType = 'mechanic_on_way';
        notificationTitle = 'Mechanic On The Way';
        notificationMessage = 'The mechanic is on the way to your location';
        break;
      case 'completed':
        notificationType = 'job_completed';
        notificationTitle = 'Job Completed';
        notificationMessage = 'Your service request has been completed';
        
        // Calculate earnings for mechanic (if not already calculated)
        if (request.mechanic_id) {
          await calculateAndCreateEarnings(requestId, request.mechanic_id);
        }
        break;
    }

    if (notificationType && request.user_id) {
      await supabase.from('notifications').insert({
        user_id: request.user_id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        data: { request_id: requestId },
      });
    }

    return res.json({ success: true, request: updatedRequest });
  } catch (err) {
    console.error('updateStatus error', err);
    return res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
};

/**
 * Helper function to find and assign nearest mechanic
 */
async function findAndAssignMechanic(userLat, userLng, excludeMechanicId = null) {
  try {
    // Get online and verified mechanics
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, availability_status, verification_status')
      .eq('role', 'mechanic')
      .eq('availability_status', 'online')
      .eq('verification_status', 'approved');

    if (profilesError || !profiles || profiles.length === 0) {
      return null;
    }

    // Filter out excluded mechanic
    const mechanicIds = profiles
      .filter(m => !excludeMechanicId || m.id !== excludeMechanicId)
      .map(m => m.id);

    if (mechanicIds.length === 0) {
      return null;
    }

    // Get locations for these mechanics
    const { data: locations, error: locationsError } = await supabase
      .from('mechanic_locations')
      .select('mechanic_id, latitude, longitude')
      .in('mechanic_id', mechanicIds);

    if (locationsError || !locations || locations.length === 0) {
      return null;
    }

    // Calculate distances and find nearest
    const mechanicsWithDistance = profiles
      .filter(m => locations.some(loc => loc.mechanic_id === m.id))
      .map(m => {
        const location = locations.find(loc => loc.mechanic_id === m.id);
        if (!location) return null;
        
        const distance = calculateDistance(
          userLat,
          userLng,
          parseFloat(location.latitude),
          parseFloat(location.longitude)
        );
        return {
          id: m.id,
          full_name: m.full_name,
          distance,
        };
      })
      .filter(m => m !== null && m.distance <= 50000) // Within 50km
      .sort((a, b) => a.distance - b.distance);

    return mechanicsWithDistance.length > 0 ? mechanicsWithDistance[0] : null;
  } catch (err) {
    console.error('findAndAssignMechanic error', err);
    return null;
  }
}

/**
 * Helper function to calculate and create earnings for mechanic
 */
async function calculateAndCreateEarnings(requestId, mechanicId) {
  try {
    // Check if earnings already exist
    const { data: existing } = await supabase
      .from('mechanic_earnings')
      .select('id')
      .eq('request_id', requestId)
      .single();

    if (existing) {
      return; // Already calculated
    }

    // Default service fee (can be customized based on request)
    const serviceFee = 500.00; // Base fee
    const commissionRate = 15.00; // 15% commission
    const commissionAmount = (serviceFee * commissionRate) / 100;
    const netAmount = serviceFee - commissionAmount;

    // Create earning record
    await supabase.from('mechanic_earnings').insert({
      mechanic_id: mechanicId,
      request_id: requestId,
      amount: serviceFee,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      net_amount: netAmount,
      payment_status: 'pending',
    });

    // Create transaction record
    await supabase.from('transactions').insert({
      mechanic_id: mechanicId,
      type: 'earning',
      amount: netAmount,
      description: `Earning from service request ${requestId}`,
      reference_id: requestId,
      status: 'completed',
    });
  } catch (err) {
    console.error('calculateAndCreateEarnings error', err);
  }
}
