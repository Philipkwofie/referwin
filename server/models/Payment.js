const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['activation', 'bonus', 'other'],
    default: 'activation'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
