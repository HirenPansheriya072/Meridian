const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'textarea', 'select', 'phone'], default: 'text' },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
  },
  { _id: true }
);

/**
 * A bookable thing: "30 min intro call".
 *
 * assignment decides how hosts are picked:
 *   single      -- one host, the simple case
 *   collective  -- ALL hosts must be free; the slot is the intersection
 *   roundRobin  -- ANY host free; the slot is the union, load-balanced on booking
 */
const eventTypeSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, default: '' },
    color: { type: String, default: 'dusk' },
    active: { type: Boolean, default: true },

    durationMinutes: { type: Number, required: true, min: 5, max: 480, default: 30 },
    // Slots are offered on this grid. 15 gives 9:00, 9:15, 9:30 for a 30-min call.
    slotIncrementMinutes: { type: Number, default: 15, min: 5, max: 120 },

    bufferBeforeMinutes: { type: Number, default: 0, min: 0, max: 120 },
    bufferAfterMinutes: { type: Number, default: 0, min: 0, max: 120 },

    // How close to the start time someone may still book.
    minimumNoticeMinutes: { type: Number, default: 60, min: 0 },
    // How far ahead the calendar is open at all.
    maximumAdvanceDays: { type: Number, default: 60, min: 1, max: 730 },
    // Stops a single day filling up entirely. Counted in the host's zone.
    maxBookingsPerDay: { type: Number, default: 0, min: 0 },

    assignment: { type: String, enum: ['single', 'collective', 'roundRobin'], default: 'single' },
    hostIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: [(v) => v.length > 0, 'An event type needs at least one host'],
    },

    location: {
      type: { type: String, enum: ['video', 'phone', 'inPerson', 'custom'], default: 'video' },
      detail: { type: String, default: '' },
    },

    questions: { type: [questionSchema], default: [] },
    requiresConfirmation: { type: Boolean, default: false },
    redirectUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

eventTypeSchema.index({ orgId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('EventType', eventTypeSchema);
