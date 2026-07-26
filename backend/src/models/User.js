const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },

    // The zone this person's working hours are written in. "9 to 5" is meaningless
    // without it, and it is NOT the same as the booker's zone.
    timezone: { type: String, default: 'UTC', required: true },
    avatarColor: { type: String, default: 'dusk' },
    title: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    bio: { type: String, trim: true },
    socialLinks: {
      website: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      instagram: { type: String, trim: true },
    },
    googleCalendar: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      refreshToken: String,
      expiryDate: Date,
      email: String,
    },
    outlookCalendar: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      refreshToken: String,
      expiryDate: Date,
      email: String,
    },
  },
  { timestamps: true }
);

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};
userSchema.methods.toPublic = function () {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    timezone: this.timezone,
    avatarColor: this.avatarColor,
    title: this.title,
    orgId: String(this.orgId),
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    socialLinks: this.socialLinks || { website: '', linkedin: '', twitter: '', instagram: '' },
    googleCalendar: this.googleCalendar ? {
      connected: this.googleCalendar.connected,
      email: this.googleCalendar.email,
    } : undefined,
    outlookCalendar: this.outlookCalendar ? {
      connected: this.outlookCalendar.connected,
      email: this.outlookCalendar.email,
    } : undefined,
  };
};

module.exports = mongoose.model('User', userSchema);
