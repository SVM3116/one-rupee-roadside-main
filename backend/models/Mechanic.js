const mongoose = require('mongoose');

const MechanicSchema = new mongoose.Schema({
  // External auth user id (e.g., Supabase user id) — used to map frontend users to mechanic docs
  uid: { type: String, trim: true, index: true, unique: true, sparse: true },
  fullName: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, index: true, sparse: true },
  phone: { type: String, trim: true },
  // Online status: true when mechanic is available to receive requests
  isOnline: { type: Boolean, default: false, index: true },
  // Optional availability reason or status
  availabilityStatus: { type: String, default: 'offline' },
  // Verification status
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending',
    index: true,
  },
  // Services offered
  services: [{ type: String }],
  // Work location
  workLocation: { type: String, trim: true },
  pincode: { type: String, trim: true },
  // Current location for matching
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  // Bank details (encrypted in production)
  bankAccountNumber: { type: String, trim: true },
  bankIFSC: { type: String, trim: true },
  bankName: { type: String, trim: true },
  bankBranch: { type: String, trim: true },
  // Documents
  documents: {
    aadhar: { type: String },
    pan: { type: String },
    skillCert: { type: String },
    passbook: { type: String },
    profilePhoto: { type: String },
  },
  // Statistics
  totalJobs: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Indexes
MechanicSchema.index({ isOnline: 1, verificationStatus: 1 });
MechanicSchema.index({ 'currentLocation.lat': 1, 'currentLocation.lng': 1 });
MechanicSchema.index({ verificationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Mechanic', MechanicSchema);
