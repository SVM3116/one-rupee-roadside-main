const { supabase } = require('../utils/supabase');

/**
 * GET /api/user/profile
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format response to match expected format
    const user = {
      uid: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    return res.json({ success: true, user });
  } catch (err) {
    console.error('getProfile error', err);
    return res.status(500).json({ error: 'Failed to get user profile', details: err.message });
  }
};

/**
 * PUT /api/user/profile
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { fullName, phone, location } = req.body;
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (fullName !== undefined) updateData.full_name = fullName;
    if (phone !== undefined) updateData.phone = phone;

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', uid)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update location in user_locations table if provided
    if (location && location.lat && location.lng) {
      const { error: locationError } = await supabase
        .from('user_locations')
        .upsert({
          user_id: uid,
          latitude: Number(location.lat),
          longitude: Number(location.lng),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (locationError) {
        console.error('Failed to update user location:', locationError);
      }
    }

    // Format response
    const user = {
      uid: updated.id,
      email: updated.email,
      fullName: updated.full_name,
      phone: updated.phone,
      role: updated.role,
      status: updated.status,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    return res.json({ success: true, user });
  } catch (err) {
    console.error('updateProfile error', err);
    return res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
};

/**
 * PUT /api/user/location
 * Update user location
 */
exports.updateLocation = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const { data, error } = await supabase
      .from('user_locations')
      .upsert({
        user_id: uid,
        latitude: Number(lat),
        longitude: Number(lng),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Format response
    const user = {
      uid: data.user_id,
      location: {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
      },
      updatedAt: data.updated_at,
    };

    return res.json({ success: true, user });
  } catch (err) {
    console.error('updateLocation error', err);
    return res.status(500).json({ error: 'Failed to update location', details: err.message });
  }
};
