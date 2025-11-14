const mongoose = require('mongoose');

const linkPostSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  platform: {
    type: String,
    enum: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'other'],
    default: 'other'
  },
  link: {
    type: String,
    required: true,
    trim: true
  },
  autoPost: {
    type: Boolean,
    default: true
  },
  posted: {
    type: Boolean,
    default: false
  },
  postedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LinkPost', linkPostSchema);
