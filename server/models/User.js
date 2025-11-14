const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  referralCode: {
    type: String,
    default: function() { return this.username; }
  },
  earnings: {
    type: Number,
    default: 0
  },
  referredUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActivated: {
    type: Boolean,
    default: false
  },
  activationFee: {
    type: Number,
    default: 70
  },
  signupDate: {
    type: Date,
    default: Date.now
  },
  upline: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  adWatchHistory: [{
    adId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ad' },
    date: { type: Date, default: Date.now }
  }],
  lastLinkViewDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
