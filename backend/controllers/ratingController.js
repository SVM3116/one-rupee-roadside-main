const Rating = require('../models/Rating');
const Mechanic = require('../models/Mechanic');
const mongoose = require('mongoose');

// In-memory fallback store
const IN_MEMORY_RATINGS = new Map();

function usingMockDB() {
  return mongoose.connection.readyState !== 1;
}

/**
 * POST /api/ratings
 * Create a rating/review
 */
exports.createRating = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { mechanicId, requestId, rating, comment, ratingId } = req.body;

    if (!mechanicId || !rating) {
      return res.status(400).json({ error: 'Mechanic ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if rating already exists for this request
    let existing;
    if (usingMockDB()) {
      existing = Array.from(IN_MEMORY_RATINGS.values())
        .find(r => r.userId === uid && r.requestId === requestId);
    } else {
      existing = await Rating.findOne({ userId: uid, requestId }).lean();
    }

    if (existing) {
      return res.status(400).json({ error: 'Rating already exists for this request' });
    }

    const ratingData = {
      ratingId: ratingId || `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: uid,
      mechanicId,
      requestId: requestId || null,
      rating: Number(rating),
      comment: comment || null,
    };

    let newRating;
    if (usingMockDB()) {
      newRating = { ...ratingData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      IN_MEMORY_RATINGS.set(newRating.ratingId, newRating);
    } else {
      newRating = await Rating.create(ratingData);
      newRating = newRating.toObject();

      // Update mechanic's average rating
      await updateMechanicRating(mechanicId);
    }

    return res.status(201).json({ success: true, rating: newRating });
  } catch (err) {
    console.error('createRating error', err);
    return res.status(500).json({ error: 'Failed to create rating' });
  }
};

/**
 * GET /api/ratings/mechanic/:mechanicId
 * Get ratings for a mechanic
 */
exports.getMechanicRatings = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const { limit = 50 } = req.query;

    let ratings;
    if (usingMockDB()) {
      ratings = Array.from(IN_MEMORY_RATINGS.values())
        .filter(r => r.mechanicId === mechanicId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, parseInt(limit));
    } else {
      ratings = await Rating.find({ mechanicId })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    // Calculate statistics
    const stats = calculateRatingStats(ratings);

    return res.json({ success: true, ratings, stats });
  } catch (err) {
    console.error('getMechanicRatings error', err);
    return res.status(500).json({ error: 'Failed to get ratings' });
  }
};

/**
 * GET /api/ratings/user
 * Get user's ratings
 */
exports.getUserRatings = async (req, res) => {
  try {
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    let ratings;
    if (usingMockDB()) {
      ratings = Array.from(IN_MEMORY_RATINGS.values())
        .filter(r => r.userId === uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      ratings = await Rating.find({ userId: uid })
        .sort({ createdAt: -1 })
        .lean();
    }

    return res.json({ success: true, ratings });
  } catch (err) {
    console.error('getUserRatings error', err);
    return res.status(500).json({ error: 'Failed to get ratings' });
  }
};

/**
 * PUT /api/ratings/:ratingId
 * Update a rating
 */
exports.updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const uid = req.user && req.user.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { rating, comment } = req.body;

    let existing;
    if (usingMockDB()) {
      existing = IN_MEMORY_RATINGS.get(ratingId);
    } else {
      existing = await Rating.findOne({ ratingId }).lean();
    }

    if (!existing) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    if (existing.userId !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData = { updatedAt: new Date() };
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      updateData.rating = Number(rating);
    }
    if (comment !== undefined) updateData.comment = comment;

    let updated;
    if (usingMockDB()) {
      updated = { ...existing, ...updateData };
      IN_MEMORY_RATINGS.set(ratingId, updated);
    } else {
      updated = await Rating.findOneAndUpdate(
        { ratingId },
        updateData,
        { new: true }
      ).lean();

      // Update mechanic's average rating
      await updateMechanicRating(existing.mechanicId);
    }

    return res.json({ success: true, rating: updated });
  } catch (err) {
    console.error('updateRating error', err);
    return res.status(500).json({ error: 'Failed to update rating' });
  }
};

/**
 * Helper function to update mechanic's average rating
 */
async function updateMechanicRating(mechanicId) {
  try {
    if (usingMockDB()) return;

    const ratings = await Rating.find({ mechanicId }).lean();
    if (ratings.length === 0) return;

    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    const average = total / ratings.length;

    await Mechanic.findOneAndUpdate(
      { uid: mechanicId },
      {
        averageRating: average,
        totalRatings: ratings.length,
      }
    );
  } catch (err) {
    console.error('updateMechanicRating error', err);
  }
}

/**
 * Helper function to calculate rating statistics
 */
function calculateRatingStats(ratings) {
  if (ratings.length === 0) {
    return {
      average: 0,
      total: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  const total = ratings.reduce((sum, r) => sum + r.rating, 0);
  const average = total / ratings.length;

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratings.forEach(r => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });

  return {
    average: Math.round(average * 10) / 10,
    total: ratings.length,
    distribution,
  };
}

