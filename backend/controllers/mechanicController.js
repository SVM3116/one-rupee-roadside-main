const Mechanic = require('../models/Mechanic');
const mongoose = require('mongoose');
const { findNearestMechanics } = require('../utils/distance');

// In-memory fallback store for development when MongoDB isn't available
const IN_MEMORY_MECHANICS = new Map();

function usingMockDB() {
  // mongoose.connection.readyState === 1 means connected
  return mongoose.connection.readyState !== 1;
}

async function upsertMechanicByUid(uid, data) {
  if (usingMockDB()) {
    const existing = IN_MEMORY_MECHANICS.get(uid) || { uid, createdAt: new Date().toISOString() };
    const updated = { ...existing, ...data, uid, updatedAt: new Date().toISOString() };
    IN_MEMORY_MECHANICS.set(uid, updated);
    return updated;
  }

  let updated = await Mechanic.findOneAndUpdate({ uid }, data, { new: true, runValidators: true }).lean();
  if (!updated) {
    const createDoc = await Mechanic.create({ uid, ...data });
    updated = createDoc.toObject();
  }
  return updated;
}

async function findMechanicByUid(uid) {
  if (usingMockDB()) return IN_MEMORY_MECHANICS.get(uid) || null;
  return await Mechanic.findOne({ uid }).select('isOnline availabilityStatus updatedAt uid').lean();
}

async function countMechanics() {
  if (usingMockDB()) return IN_MEMORY_MECHANICS.size;
  return await Mechanic.countDocuments();
}

/**
 * POST /api/mechanic/toggle-online
 * body: { isOnline }
 * Requires authentication middleware to set req.user.id
 */
exports.toggleOnline = async (req, res) => {
  try {
    const { isOnline, mechanicId } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline (boolean) is required' });
    }

    // Get uid from user (set by middleware) or from body (dev fallback)
    const uid = (req.user && req.user.id) || mechanicId;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized: user ID required' });
    }

    console.log('[toggleOnline] Updating mechanic status', { uid, isOnline });

    const updated = await upsertMechanicByUid(uid, { 
      isOnline, 
      availabilityStatus: isOnline ? 'online' : 'offline' 
    });

    // CRITICAL: Update Supabase profiles table to sync availability_status
    // This ensures admin dashboard and job assignment can see the correct status
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const now = new Date().toISOString();
        const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${uid}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ 
            availability_status: isOnline ? 'online' : 'offline',
            updated_at: now
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[toggleOnline] Failed to sync to Supabase:', response.status, errorText);
          // This is critical - fail the request if Supabase sync fails
          return res.status(500).json({ 
            error: 'Failed to update status in database',
            details: errorText 
          });
        } else {
          console.log('[toggleOnline] ✅ Successfully synced availability_status to Supabase:', isOnline ? 'online' : 'offline');
        }
      } else {
        console.warn('[toggleOnline] Supabase credentials not configured - skipping sync');
      }
    } catch (supabaseErr) {
      console.error('[toggleOnline] Error syncing to Supabase:', supabaseErr);
      // This is critical - fail the request if Supabase sync fails
      return res.status(500).json({ 
        error: 'Failed to update status in database',
        details: supabaseErr.message 
      });
    }
    
    return res.json({ success: true, mechanic: updated });
  } catch (err) {
    console.error('toggleOnline error', err);
    return res.status(500).json({ error: 'Failed to update mechanic status' });
  }
};

/**
 * GET /api/mechanic/online-status/:id?
 * If :id provided -> public lookup by uid
 * If no :id and authenticated -> return current user's status
 */
exports.getOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const lookupId = id || (req.user && req.user.id);
    if (!lookupId) return res.status(400).json({ error: 'Mechanic id required or authenticate' });

    const mech = await findMechanicByUid(lookupId);
    if (!mech) {
      // If mechanic doesn't exist, return default offline status instead of 404
      // This allows the toggle to work even if mechanic hasn't been created yet
      return res.json({ 
        success: true, 
        status: { 
          isOnline: false, 
          availabilityStatus: 'offline', 
          updatedAt: null, 
          uid: lookupId 
        } 
      });
    }

    return res.json({ success: true, status: { isOnline: mech.isOnline, availabilityStatus: mech.availabilityStatus, updatedAt: mech.updatedAt, uid: mech.uid } });
  } catch (err) {
    console.error('getOnlineStatus error', err);
    return res.status(500).json({ error: 'Failed to get online status' });
  }
};

/**
 * GET /api/mechanic/ping
 * health check: server time, db state, mechanic count
 */
exports.ping = async (req, res) => {
  try {
    const state = mongoose.connection.readyState; // 1 means connected
    let count = null;
    try {
      count = await countMechanics();
    } catch (e) {
      count = null;
    }

    return res.json({ success: true, time: new Date().toISOString(), dbState: state, mechanicCount: count });
  } catch (err) {
    console.error('ping error', err);
    return res.status(500).json({ error: 'Ping failed' });
  }
};

/**
 * PUT /api/mechanic/location
 * Update mechanic's current location
 */
exports.updateLocation = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const updated = await upsertMechanicByUid(uid, {
      currentLocation: { lat: Number(lat), lng: Number(lng) },
    });

    return res.json({ success: true, mechanic: updated });
  } catch (err) {
    console.error('updateLocation error', err);
    return res.status(500).json({ error: 'Failed to update location' });
  }
};

/**
 * GET /api/mechanic/nearby
 * Find nearby mechanics (public endpoint)
 */
exports.findNearby = async (req, res) => {
  try {
    const { lat, lng, radius = 10000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    let mechanics;
    if (usingMockDB()) {
      mechanics = [];
    } else {
      mechanics = await Mechanic.find({
        isOnline: true,
        verificationStatus: 'approved',
        'currentLocation.lat': { $exists: true },
        'currentLocation.lng': { $exists: true },
      }).lean();
    }

    const nearest = findNearestMechanics(
      mechanics,
      Number(lat),
      Number(lng),
      Number(radius)
    );

    return res.json({ success: true, mechanics: nearest });
  } catch (err) {
    console.error('findNearby error', err);
    return res.status(500).json({ error: 'Failed to find nearby mechanics' });
  }
};

/**
 * GET /api/mechanic/requests
 * Get mechanic's assigned requests
 */
exports.getRequests = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const Request = require('../models/Request');
    const { status, limit = 50 } = req.query;

    let requests = [];
    if (!usingMockDB()) {
      const query = { mechanicId: uid };
      if (status) query.status = status;

      requests = await Request.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    return res.json({ success: true, requests });
  } catch (err) {
    console.error('getRequests error', err);
    return res.status(500).json({ error: 'Failed to get requests' });
  }
};
