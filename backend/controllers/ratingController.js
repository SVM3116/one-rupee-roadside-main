const { supabase } = require('../utils/supabase');

/**
 * POST /api/ratings
 * Create a rating/review
 */
exports.createRating = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { mechanic_id, request_id, rating, comment } = req.body;

    if (!mechanic_id || !rating) {
      return res.status(400).json({ error: 'Mechanic ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if rating already exists for this request
    if (request_id) {
      const { data: existing } = await supabase
        .from('testimonials')
        .select('id')
        .eq('user_id', uid)
        .eq('mechanic_id', mechanic_id)
        .eq('request_id', request_id)
        .single();

      if (existing) {
        return res.status(400).json({ error: 'Rating already exists for this request' });
      }
    }

    // Create rating
    const { data: newRating, error } = await supabase
      .from('testimonials')
      .insert({
        user_id: uid,
        mechanic_id,
        request_id: request_id || null,
        rating: Number(rating),
        comment: comment || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update mechanic's average rating (calculate from all ratings)
    await updateMechanicRating(mechanic_id);

    return res.status(201).json({ success: true, rating: newRating });
  } catch (err) {
    console.error('createRating error', err);
    return res.status(500).json({ error: 'Failed to create rating', details: err.message });
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

    const { data: ratings, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('mechanic_id', mechanicId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = calculateRatingStats(ratings || []);

    return res.json({ success: true, ratings: ratings || [], stats });
  } catch (err) {
    console.error('getMechanicRatings error', err);
    return res.status(500).json({ error: 'Failed to get ratings', details: err.message });
  }
};

/**
 * GET /api/ratings/user
 * Get user's ratings
 */
exports.getUserRatings = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { data: ratings, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({ success: true, ratings: ratings || [] });
  } catch (err) {
    console.error('getUserRatings error', err);
    return res.status(500).json({ error: 'Failed to get ratings', details: err.message });
  }
};

/**
 * PUT /api/ratings/:ratingId
 * Update a rating
 */
exports.updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { rating, comment } = req.body;

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('testimonials')
      .select('*')
      .eq('id', ratingId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    if (existing.user_id !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      updateData.rating = Number(rating);
    }
    if (comment !== undefined) {
      updateData.comment = comment;
    }

    const { data: updated, error } = await supabase
      .from('testimonials')
      .update(updateData)
      .eq('id', ratingId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update mechanic's average rating
    await updateMechanicRating(existing.mechanic_id);

    return res.json({ success: true, rating: updated });
  } catch (err) {
    console.error('updateRating error', err);
    return res.status(500).json({ error: 'Failed to update rating', details: err.message });
  }
};

/**
 * Helper function to update mechanic's average rating
 */
async function updateMechanicRating(mechanicId) {
  try {
    const { data: ratings, error } = await supabase
      .from('testimonials')
      .select('rating')
      .eq('mechanic_id', mechanicId);

    if (error || !ratings || ratings.length === 0) {
      return;
    }

    const total = ratings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const average = total / ratings.length;

    // Note: We can't directly update average_rating in profiles table
    // as it's not a standard field. This calculation can be done on-the-fly
    // or you can add a computed field in Supabase.
    // For now, we'll just calculate it when needed.
  } catch (err) {
    console.error('updateMechanicRating error', err);
  }
}

/**
 * Helper function to calculate rating statistics
 */
function calculateRatingStats(ratings) {
  if (!ratings || ratings.length === 0) {
    return {
      average: 0,
      total: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  const total = ratings.reduce((sum, r) => sum + (r.rating || 0), 0);
  const average = total / ratings.length;

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratings.forEach(r => {
    const rating = r.rating || 0;
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = (distribution[rating] || 0) + 1;
    }
  });

  return {
    average: Math.round(average * 10) / 10,
    total: ratings.length,
    distribution,
  };
}
