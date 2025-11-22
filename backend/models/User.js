const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: { type: String, trim: true, index: true, unique: true, sparse: true },
  email: { type: String, trim: true, lowercase: true, index: true, sparse: true },
  fullName: { type: String, trim: true },
  phone: { type: String, trim: true },
  role: { type: String, enum: ['traveler', 'mechanic', 'admin'], default: 'traveler' },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Index for geospatial queries
UserSchema.index({ 'location.lat': 1, 'location.lng': 1 });

module.exports = mongoose.model('User', UserSchema);

