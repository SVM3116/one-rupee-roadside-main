const Mechanic = require('../models/Mechanic');
const Request = require('../models/Request');
const User = require('../models/User');
const Rating = require('../models/Rating');
const mongoose = require('mongoose');

function usingMockDB() {
  return mongoose.connection.readyState !== 1;
}

/**
 * GET /api/admin/stats
 * Get system statistics
 */
exports.getStats = async (req, res) => {
  try {
    let stats = {
      users: 0,
      mechanics: 0,
      requests: 0,
      completedRequests: 0,
      pendingRequests: 0,
      ratings: 0,
      averageRating: 0,
    };

    if (!usingMockDB()) {
      stats.users = await User.countDocuments();
      stats.mechanics = await Mechanic.countDocuments();
      stats.requests = await Request.countDocuments();
      stats.completedRequests = await Request.countDocuments({ status: 'completed' });
      stats.pendingRequests = await Request.countDocuments({ status: 'pending' });
      stats.ratings = await Rating.countDocuments();

      const allRatings = await Rating.find().lean();
      if (allRatings.length > 0) {
        const total = allRatings.reduce((sum, r) => sum + r.rating, 0);
        stats.averageRating = Math.round((total / allRatings.length) * 10) / 10;
      }
    }

    return res.json({ success: true, stats });
  } catch (err) {
    console.error('getStats error', err);
    return res.status(500).json({ error: 'Failed to get statistics' });
  }
};

/**
 * GET /api/admin/mechanics
 * Get all mechanics with filters
 */
exports.getMechanics = async (req, res) => {
  try {
    const { verificationStatus, isOnline, limit = 100 } = req.query;

    let mechanics = [];
    if (!usingMockDB()) {
      const query = {};
      if (verificationStatus) query.verificationStatus = verificationStatus;
      if (isOnline !== undefined) query.isOnline = isOnline === 'true';

      mechanics = await Mechanic.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    return res.json({ success: true, mechanics });
  } catch (err) {
    console.error('getMechanics error', err);
    return res.status(500).json({ error: 'Failed to get mechanics' });
  }
};

/**
 * PUT /api/admin/mechanics/:mechanicId/verify
 * Approve or reject mechanic verification
 */
exports.verifyMechanic = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user && req.user.id;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    if (action === 'reject' && !reason) {
      return res.status(400).json({ error: 'Reason is required for rejection' });
    }

    if (usingMockDB()) {
      return res.json({
        success: true,
        mechanic: { uid: mechanicId, verificationStatus: action === 'approve' ? 'approved' : 'rejected' },
        message: `Mechanic ${action}d successfully`,
      });
    }

    const verificationStatus = action === 'approve' ? 'approved' : 'rejected';
    const mechanic = await Mechanic.findOneAndUpdate(
      { uid: mechanicId },
      { verificationStatus },
      { new: true }
    ).lean();

    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    // In production, you would log this to mechanic_verification_logs table in Supabase
    // For now, we'll just return success

    return res.json({
      success: true,
      mechanic,
      message: `Mechanic ${action}d successfully`,
    });
  } catch (err) {
    console.error('verifyMechanic error', err);
    return res.status(500).json({ error: 'Failed to verify mechanic' });
  }
};

/**
 * GET /api/admin/requests
 * Get all requests with filters
 */
exports.getRequests = async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    let requests = [];
    if (!usingMockDB()) {
      const query = {};
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

    if (usingMockDB()) {
      return res.json({
        success: true,
        request: { requestId, mechanicId, status: 'pending' },
        message: 'Mechanic assigned successfully',
      });
    }

    const request = await Request.findOneAndUpdate(
      { requestId },
      {
        mechanicId,
        assignedAt: new Date(),
        status: 'pending', // Mechanic still needs to accept
      },
      { new: true }
    ).lean();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.json({
      success: true,
      request,
      message: 'Mechanic assigned successfully',
    });
  } catch (err) {
    console.error('assignMechanic error', err);
    return res.status(500).json({ error: 'Failed to assign mechanic' });
  }
};

/**
 * GET /api/admin/users
 * Get all users
 */
exports.getUsers = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    let users = [];
    if (!usingMockDB()) {
      users = await User.find()
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    return res.json({ success: true, users });
  } catch (err) {
    console.error('getUsers error', err);
    return res.status(500).json({ error: 'Failed to get users' });
  }
};

