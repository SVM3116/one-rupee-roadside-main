const { supabase } = require('../utils/supabase');
const { calculateDistance } = require('../utils/distance');

/**
 * POST /api/mechanic/toggle-online
 * Toggle mechanic online/offline status
 */
exports.toggleOnline = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline (boolean) is required' });
    }

    const availabilityStatus = isOnline ? 'online' : 'offline';

    // Update profile (role check is done by middleware)
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({
        availability_status: availabilityStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      mechanic: {
        uid: updated.id,
        isOnline,
        availabilityStatus,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    console.error('toggleOnline error', err);
    return res.status(500).json({ error: 'Failed to update mechanic status', details: err.message });
  }
};

/**
 * GET /api/mechanic/online-status/:id?
 * Get mechanic online status
 */
exports.getOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = id || req.user?.id;
    if (!uid) {
      return res.status(400).json({ error: 'Mechanic id required or authenticate' });
    }

    // Check if user is a mechanic via user_roles
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', uid)
      .eq('role', 'mechanic')
      .maybeSingle();

    // If not a mechanic, return offline status
    if (roleError || !roleData) {
      return res.json({
        success: true,
        status: {
          isOnline: false,
          availabilityStatus: 'offline',
          updatedAt: null,
          uid,
        },
      });
    }

    // Get profile for availability status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('availability_status, updated_at')
      .eq('id', uid)
      .maybeSingle();

    if (profileError || !profile) {
      // Return default offline status if profile doesn't exist
      return res.json({
        success: true,
        status: {
          isOnline: false,
          availabilityStatus: 'offline',
          updatedAt: null,
          uid,
        },
      });
    }

    const isOnline = profile.availability_status === 'online';

    return res.json({
      success: true,
      status: {
        isOnline,
        availabilityStatus: profile.availability_status || 'offline',
        updatedAt: profile.updated_at,
        uid,
      },
    });
  } catch (err) {
    console.error('getOnlineStatus error', err);
    return res.status(500).json({ error: 'Failed to get online status', details: err.message });
  }
};

/**
 * GET /api/mechanic/ping
 * Health check endpoint
 */
exports.ping = async (req, res) => {
  try {
    // Count mechanics via user_roles table
    const { count, error: countError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'mechanic');

    if (countError) {
      console.warn('Error counting mechanics:', countError);
    }

    return res.json({
      success: true,
      time: new Date().toISOString(),
      dbState: supabase ? 'connected' : 'disconnected',
      mechanicCount: count || 0,
    });
  } catch (err) {
    console.error('ping error', err);
    return res.status(500).json({ error: 'Ping failed', details: err.message });
  }
};

/**
 * PUT /api/mechanic/location
 * Update mechanic's current location
 */
exports.updateLocation = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Update mechanic location
    const { data, error } = await supabase
      .from('mechanic_locations')
      .upsert({
        mechanic_id: uid,
        latitude: Number(lat),
        longitude: Number(lng),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'mechanic_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      mechanic: {
        uid,
        currentLocation: {
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude),
        },
        updatedAt: data.updated_at,
      },
    });
  } catch (err) {
    console.error('updateLocation error', err);
    return res.status(500).json({ error: 'Failed to update location', details: err.message });
  }
};

/**
 * GET /api/mechanic/nearby
 * Find nearby mechanics
 */
exports.findNearby = async (req, res) => {
  try {
    const { lat, lng, radius = 50000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Get mechanic IDs from user_roles first
    const { data: mechanicRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'mechanic');

    if (roleError || !mechanicRoles || mechanicRoles.length === 0) {
      return res.json({ success: true, mechanics: [] });
    }

    const mechanicIds = mechanicRoles.map(r => r.user_id);

    // Get online and verified mechanics with locations
    const { data: mechanics, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone,
        services,
        verification_status,
        availability_status,
        mechanic_locations!inner(latitude, longitude)
      `)
      .in('id', mechanicIds)
      .eq('availability_status', 'online')
      .eq('verification_status', 'approved');

    if (error) {
      throw error;
    }

    if (!mechanics || mechanics.length === 0) {
      return res.json({ success: true, mechanics: [] });
    }

    // Calculate distances and filter
    const mechanicsWithDistance = mechanics
      .filter(m => m.mechanic_locations && m.mechanic_locations.length > 0)
      .map(m => {
        const location = m.mechanic_locations[0];
        const distance = calculateDistance(
          Number(lat),
          Number(lng),
          parseFloat(location.latitude),
          parseFloat(location.longitude)
        );
        return {
          uid: m.id,
          fullName: m.full_name,
          phone: m.phone,
          services: m.services || [],
          isOnline: m.availability_status === 'online',
          distance: Math.round(distance),
        };
      })
      .filter(m => m.distance <= Number(radius))
      .sort((a, b) => a.distance - b.distance);

    return res.json({ success: true, mechanics: mechanicsWithDistance });
  } catch (err) {
    console.error('findNearby error', err);
    return res.status(500).json({ error: 'Failed to find nearby mechanics', details: err.message });
  }
};

/**
 * GET /api/mechanic/requests
 * Get mechanic's assigned requests
 */
exports.getRequests = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { status, limit = 50 } = req.query;

    let query = supabase
      .from('job_requests')
      .select('*')
      .eq('mechanic_id', uid)
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
    console.error('getRequests error', err);
    return res.status(500).json({ error: 'Failed to get requests', details: err.message });
  }
};
