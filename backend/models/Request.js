const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, sparse: true }, // Supabase UUID
  userId: { type: String, required: true, index: true },
  mechanicId: { type: String, index: true, sparse: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  vehicleType: { type: String, trim: true },
  issueDescription: { type: String, trim: true },
  mediaUrls: [{ type: String }],
  userLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  mechanicLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  assignedAt: { type: Date },
  acceptedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Indexes for queries
RequestSchema.index({ userId: 1, status: 1 });
RequestSchema.index({ mechanicId: 1, status: 1 });
RequestSchema.index({ status: 1, createdAt: -1 });
RequestSchema.index({ 'userLocation.lat': 1, 'userLocation.lng': 1 });

module.exports = mongoose.model('Request', RequestSchema);

