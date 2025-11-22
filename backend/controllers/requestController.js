const Request = require('../models/Request');
const Mechanic = require('../models/Mechanic');
const { findNearestMechanics } = require('../utils/distance');
const mongoose = require('mongoose');

// In-memory fallback store
const IN_MEMORY_REQUESTS = new Map();

function usingMockDB() {
  return mongoose.connection.readyState !== 1;
}

/**
 * POST /api/requests
 * Create a new service request
 */
exports.createRequest = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { vehicleType, issueDescription, userLocation, mediaUrls, requestId } = req.body;

    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return res.status(400).json({ error: 'User location is required' });
    }

    if (!vehicleType || !issueDescription) {
      return res.status(400).json({ error: 'Vehicle type and issue description are required' });
    }

    const requestData = {
      requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: uid,
      vehicleType,
      issueDescription,
      mediaUrls: mediaUrls || [],
      userLocation: {
        lat: Number(userLocation.lat),
        lng: Number(userLocation.lng),
      },
      status: 'pending',
    };

    let request;
    if (usingMockDB()) {
      request = { ...requestData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      IN_MEMORY_REQUESTS.set(request.requestId, request);
    } else {
      request = await Request.create(requestData);
      request = request.toObject();
    }

    // Try to find and assign nearest mechanic
    try {
      const assignedMechanic = await findAndAssignMechanic(request.userLocation.lat, request.userLocation.lng);
      if (assignedMechanic) {
        request.mechanicId = assignedMechanic.uid;
        request.assignedAt = new Date();
        
        if (usingMockDB()) {
          IN_MEMORY_REQUESTS.set(request.requestId, request);
        } else {
          await Request.findOneAndUpdate(
            { requestId: request.requestId },
            { mechanicId: assignedMechanic.uid, assignedAt: new Date() }
          );
        }
      }
    } catch (assignErr) {
      console.warn('Failed to auto-assign mechanic:', assignErr);
    }

    return res.status(201).json({ success: true, request });
  } catch (err) {
    console.error('createRequest error', err);
    return res.status(500).json({ error: 'Failed to create request' });
  }
};

/**
 * GET /api/requests
 * Get user's requests
 */
exports.getUserRequests = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { status, limit = 50 } = req.query;

    let requests;
    if (usingMockDB()) {
      requests = Array.from(IN_MEMORY_REQUESTS.values())
        .filter(r => r.userId === uid && (!status || r.status === status))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, parseInt(limit));
    } else {
      const query = { userId: uid };
      if (status) query.status = status;
      
      requests = await Request.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    return res.json({ success: true, requests });
  } catch (err) {
    console.error('getUserRequests error', err);
    return res.status(500).json({ error: 'Failed to get requests' });
  }
};

/**
 * GET /api/requests/:requestId
 * Get a specific request
 */
exports.getRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    let request;
    if (usingMockDB()) {
      request = IN_MEMORY_REQUESTS.get(requestId);
    } else {
      request = await Request.findOne({ requestId }).lean();
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user has access
    if (request.userId !== uid && request.mechanicId !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error('getRequest error', err);
    return res.status(500).json({ error: 'Failed to get request' });
  }
};

/**
 * PUT /api/requests/:requestId/accept
 * Mechanic accepts a request
 */
exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    let request;
    if (usingMockDB()) {
      request = IN_MEMORY_REQUESTS.get(requestId);
    } else {
      request = await Request.findOne({ requestId }).lean();
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.mechanicId !== uid) {
      return res.status(403).json({ error: 'You are not assigned to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not in pending status' });
    }

    const updateData = {
      status: 'accepted',
      acceptedAt: new Date(),
    };

    if (usingMockDB()) {
      request = { ...request, ...updateData, updatedAt: new Date().toISOString() };
      IN_MEMORY_REQUESTS.set(requestId, request);
    } else {
      request = await Request.findOneAndUpdate(
        { requestId },
        updateData,
        { new: true }
      ).lean();
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error('acceptRequest error', err);
    return res.status(500).json({ error: 'Failed to accept request' });
  }
};

/**
 * PUT /api/requests/:requestId/reject
 * Mechanic rejects a request
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    let request;
    if (usingMockDB()) {
      request = IN_MEMORY_REQUESTS.get(requestId);
    } else {
      request = await Request.findOne({ requestId }).lean();
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.mechanicId !== uid) {
      return res.status(403).json({ error: 'You are not assigned to this request' });
    }

    const updateData = {
      status: 'pending',
      mechanicId: null,
      assignedAt: null,
    };

    if (usingMockDB()) {
      request = { ...request, ...updateData, updatedAt: new Date().toISOString() };
      IN_MEMORY_REQUESTS.set(requestId, request);
    } else {
      request = await Request.findOneAndUpdate(
        { requestId },
        updateData,
        { new: true }
      ).lean();
    }

    // Try to reassign to another mechanic
    try {
      const assignedMechanic = await findAndAssignMechanic(request.userLocation.lat, request.userLocation.lng, uid);
      if (assignedMechanic) {
        request.mechanicId = assignedMechanic.uid;
        request.assignedAt = new Date();
        
        if (usingMockDB()) {
          IN_MEMORY_REQUESTS.set(requestId, request);
        } else {
          await Request.findOneAndUpdate(
            { requestId },
            { mechanicId: assignedMechanic.uid, assignedAt: new Date() }
          );
        }
      }
    } catch (assignErr) {
      console.warn('Failed to reassign mechanic:', assignErr);
    }

    return res.json({ success: true, request, reassigned: !!request.mechanicId });
  } catch (err) {
    console.error('rejectRequest error', err);
    return res.status(500).json({ error: 'Failed to reject request' });
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
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const validStatuses = ['pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let request;
    if (usingMockDB()) {
      request = IN_MEMORY_REQUESTS.get(requestId);
    } else {
      request = await Request.findOne({ requestId }).lean();
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check permissions
    if (request.userId !== uid && request.mechanicId !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData = { status, updatedAt: new Date() };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (usingMockDB()) {
      request = { ...request, ...updateData };
      IN_MEMORY_REQUESTS.set(requestId, request);
    } else {
      request = await Request.findOneAndUpdate(
        { requestId },
        updateData,
        { new: true }
      ).lean();
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error('updateStatus error', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

/**
 * Helper function to find and assign nearest mechanic
 */
async function findAndAssignMechanic(userLat, userLng, excludeMechanicId = null) {
  try {
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

    if (excludeMechanicId) {
      mechanics = mechanics.filter(m => m.uid !== excludeMechanicId);
    }

    if (mechanics.length === 0) return null;

    const nearest = findNearestMechanics(mechanics, userLat, userLng, 10000);
    return nearest.length > 0 ? nearest[0] : null;
  } catch (err) {
    console.error('findAndAssignMechanic error', err);
    return null;
  }
}

