const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
  ratingId: { type: String, unique: true, sparse: true }, // Supabase UUID
  userId: { type: String, required: true, index: true },
  mechanicId: { type: String, required: true, index: true },
  requestId: { type: String, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Index for getting mechanic ratings
RatingSchema.index({ mechanicId: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', RatingSchema);

