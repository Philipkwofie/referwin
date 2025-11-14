const mongoose = require('mongoose');

const whatsAppSettingsSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Ensure only one document exists
whatsAppSettingsSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    if (count > 0) {
      const error = new Error('Only one WhatsApp settings document is allowed');
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('WhatsAppSettings', whatsAppSettingsSchema);
