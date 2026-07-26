const mongoose = require('mongoose');

/**
 * A named set of working hours, owned by one host.
 *
 * Times are stored as MINUTES FROM LOCAL MIDNIGHT, not as instants. That is the
 * whole trick: "09:00" is a rule about the host's wall clock, and it has to stay
 * 09:00 on both sides of a daylight-saving transition. Store it as an instant and
 * every host silently starts work an hour early each spring.
 */
const windowSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true, min: 0, max: 1440 },
    end: { type: Number, required: true, min: 0, max: 1440 },
  },
  { _id: false }
);

const overrideSchema = new mongoose.Schema(
  {
    // 'YYYY-MM-DD' as read in the host's zone.
    date: { type: String, required: true },
    label: { type: String, trim: true },
    // Empty windows array means "closed that day" -- a holiday.
    windows: { type: [windowSchema], default: [] },
  },
  { _id: true }
);

const scheduleSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, default: 'Working hours' },
    isDefault: { type: Boolean, default: false },

    // Index 0 is Sunday, matching Date.getUTCDay().
    weekly: {
      type: [[windowSchema]],
      default: () => [[], [], [], [], [], [], []],
      validate: [(v) => v.length === 7, 'weekly must have exactly 7 days'],
    },

    overrides: { type: [overrideSchema], default: [] },
  },
  { timestamps: true }
);

scheduleSchema.statics.nineToFive = function () {
  const weekday = [{ start: 9 * 60, end: 17 * 60 }];
  return [[], weekday, weekday, weekday, weekday, weekday, []];
};

module.exports = mongoose.model('Schedule', scheduleSchema);
