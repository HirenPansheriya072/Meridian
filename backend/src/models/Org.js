const mongoose = require('mongoose');

const orgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    timezone: { type: String, default: 'UTC' },
    brandColor: { type: String, default: '#2B3A67', trim: true },
    logoUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Org', orgSchema);
