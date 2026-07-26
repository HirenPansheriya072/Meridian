const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * A confirmed slot.
 *
 * startAt/endAt are UTC instants -- the single source of truth. The zone fields are
 * kept alongside for display and for the audit trail: if a host later moves country,
 * we still know what time the customer thought they were booking.
 */
const bookingSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    eventTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventType', required: true, index: true },
    eventTitle: { type: String, required: true },

    hostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },

    hostTimezone: { type: String, required: true },
    bookerTimezone: { type: String, required: true },

    attendee: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      notes: { type: String, trim: true },
    },
    answers: { type: Map, of: String, default: {} },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'rescheduled'],
      default: 'confirmed',
      index: true,
    },
    cancelReason: { type: String, trim: true },
    cancelledBy: { type: String, enum: ['host', 'attendee'], default: undefined },

    // Lets an attendee manage their booking without an account. Unguessable.
    manageToken: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(24).toString('base64url'),
    },
    rescheduledFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

    location: {
      type: { type: String },
      detail: { type: String },
    },

    remindersSent: { type: [String], default: [] },
  },
  { timestamps: true }
);

// The guard against double-booking a host. Partial, so cancelled bookings do not
// occupy the slot and the same time can be rebooked after a cancellation.
bookingSchema.index(
  { orgId: 1, startAt: 1, hostIds: 1 },
  { partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);

bookingSchema.index({ orgId: 1, startAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
