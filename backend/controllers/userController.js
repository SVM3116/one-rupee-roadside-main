const User = require('../models/User');
const mongoose = require('mongoose');

// In-memory fallback store for development when MongoDB isn't available
const IN_MEMORY_USERS = new Map();

function usingMockDB() {
  return mongoose.connection.readyState !== 1;
}

async function upsertUserByUid(uid, data) {
  if (usingMockDB()) {
    const existing = IN_MEMORY_USERS.get(uid) || { uid, createdAt: new Date().toISOString() };
    const updated = { ...existing, ...data, uid, updatedAt: new Date().toISOString() };
    IN_MEMORY_USERS.set(uid, updated);
    return updated;
  }

  let updated = await User.findOneAndUpdate(
    { uid },
    { ...data, updatedAt: new Date() },
    { new: true, runValidators: true, upsert: true }
  ).lean();
  return updated;
}

async function findUserByUid(uid) {
  if (usingMockDB()) return IN_MEMORY_USERS.get(uid) || null;
  return await User.findOne({ uid }).lean();
}

/**
 * GET /api/user/profile
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (err) {
    console.error('getProfile error', err);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
};

/**
 * PUT /api/user/profile
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { fullName, phone, location } = req.body;
    const updateData = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) {
      if (location.lat && location.lng) {
        updateData.location = { lat: location.lat, lng: location.lng };
      }
    }

    const updated = await upsertUserByUid(uid, updateData);
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('updateProfile error', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * PUT /api/user/location
 * Update user location
 */
exports.updateLocation = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const updated = await upsertUserByUid(uid, {
      location: { lat: Number(lat), lng: Number(lng) },
    });

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('updateLocation error', err);
    return res.status(500).json({ error: 'Failed to update location' });
  }
};

