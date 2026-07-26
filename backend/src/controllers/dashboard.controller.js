const mongoose = require('mongoose');
const EventType = require('../models/EventType');
const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const tz = require('../utils/tz');
const { sendCancellation } = require('../services/mailer');

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function uniqueEventSlug(orgId, title, excludeId) {
  const base = slugify(title) || 'meeting';
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { orgId, slug };
    if (excludeId) query._id = { $ne: excludeId };
    if (!(await EventType.findOne(query).lean())) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

/* ---------- event types ---------- */

const listEventTypes = asyncHandler(async (req, res) => {
  const items = await EventType.find({ orgId: req.orgId }).sort({ createdAt: -1 }).lean();

  const counts = await Booking.aggregate([
    { $match: { orgId: new mongoose.Types.ObjectId(String(req.orgId)), status: { $in: ['confirmed', 'pending'] } } },
    { $group: { _id: '$eventTypeId', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));

  res.json({ items: items.map((e) => ({ ...e, bookingCount: byId.get(String(e._id)) || 0 })) });
});

const getEventType = asyncHandler(async (req, res) => {
  const eventType = await EventType.findOne({ _id: req.params.id, orgId: req.orgId }).lean();
  if (!eventType) throw ApiError.notFound('That event type does not exist');
  res.json({ eventType });
});

const createEventType = asyncHandler(async (req, res) => {
  const hosts = await User.find({ _id: { $in: req.body.hostIds }, orgId: req.orgId }).lean();
  if (hosts.length !== req.body.hostIds.length) throw ApiError.badRequest('One of those hosts is not on your team');

  const eventType = await EventType.create({
    ...req.body,
    orgId: req.orgId,
    slug: await uniqueEventSlug(req.orgId, req.body.title),
  });
  res.status(201).json({ eventType });
});

const updateEventType = asyncHandler(async (req, res) => {
  const eventType = await EventType.findOne({ _id: req.params.id, orgId: req.orgId });
  if (!eventType) throw ApiError.notFound('That event type does not exist');

  if (req.body.hostIds) {
    const hosts = await User.find({ _id: { $in: req.body.hostIds }, orgId: req.orgId }).lean();
    if (hosts.length !== req.body.hostIds.length) throw ApiError.badRequest('One of those hosts is not on your team');
  }
  // Re-slug on rename, but only on rename -- shared links should not rot casually.
  if (req.body.title && req.body.title !== eventType.title) {
    eventType.slug = await uniqueEventSlug(req.orgId, req.body.title, eventType._id);
  }

  Object.assign(eventType, req.body);
  await eventType.save();
  res.json({ eventType });
});

const deleteEventType = asyncHandler(async (req, res) => {
  const eventType = await EventType.findOne({ _id: req.params.id, orgId: req.orgId });
  if (!eventType) throw ApiError.notFound('That event type does not exist');

  const upcoming = await Booking.countDocuments({
    eventTypeId: eventType._id,
    status: { $in: ['pending', 'confirmed'] },
    startAt: { $gte: new Date() },
  });
  // Deleting would orphan people who already have it in their calendar.
  if (upcoming > 0) {
    eventType.active = false;
    await eventType.save();
    return res.json({
      deactivated: true,
      message: `${upcoming} upcoming booking${upcoming === 1 ? '' : 's'} use this, so it was switched off instead of deleted.`,
    });
  }

  await eventType.deleteOne();
  res.json({ deleted: true });
});

/* ---------- schedule ---------- */

const getSchedule = asyncHandler(async (req, res) => {
  let schedule = await Schedule.findOne({ userId: req.user._id }).lean();
  if (!schedule) {
    schedule = (
      await Schedule.create({
        orgId: req.orgId,
        userId: req.user._id,
        isDefault: true,
        weekly: Schedule.nineToFive(),
      })
    ).toObject();
  }
  res.json({ schedule, timezone: req.user.timezone });
});

const updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { ...req.body, orgId: req.orgId, userId: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ schedule });
});

/* ---------- bookings ---------- */

const listBookings = asyncHandler(async (req, res) => {
  const range = req.query.range || 'upcoming';
  const now = new Date();

  const filter = { orgId: req.orgId };
  if (range === 'upcoming') {
    filter.startAt = { $gte: now };
    filter.status = { $in: ['pending', 'confirmed'] };
  } else if (range === 'past') {
    filter.startAt = { $lt: now };
    filter.status = { $in: ['confirmed', 'pending'] };
  } else if (range === 'cancelled') {
    filter.status = { $in: ['cancelled', 'rescheduled'] };
  }

  const items = await Booking.find(filter)
    .sort({ startAt: range === 'upcoming' ? 1 : -1 })
    .limit(100)
    .populate('hostIds', 'name avatarColor timezone')
    .lean();

  const [upcoming, past, cancelled] = await Promise.all([
    Booking.countDocuments({ orgId: req.orgId, startAt: { $gte: now }, status: { $in: ['pending', 'confirmed'] } }),
    Booking.countDocuments({ orgId: req.orgId, startAt: { $lt: now }, status: { $in: ['confirmed', 'pending'] } }),
    Booking.countDocuments({ orgId: req.orgId, status: { $in: ['cancelled', 'rescheduled'] } }),
  ]);

  res.json({ items, counts: { upcoming, past, cancelled } });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, orgId: req.orgId });
  if (!booking) throw ApiError.notFound('No such booking');
  if (booking.status === 'cancelled') throw ApiError.badRequest('Already cancelled');

  booking.status = 'cancelled';
  booking.cancelReason = req.body.reason;
  booking.cancelledBy = 'host';
  await booking.save();

  const hosts = await User.find({ _id: { $in: booking.hostIds } }).lean();
  sendCancellation({ booking, hosts, reason: req.body.reason, cancelledBy: 'host' }).catch((err) =>
    console.error('cancellation email failed', err.message)
  );

  res.json({ ok: true });
});

/* ---------- overview ---------- */

const summary = asyncHandler(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(String(req.orgId));
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 13 * 86400000);

  const [next, thisWeek, totals, byEvent, daily, byZone] = await Promise.all([
    Booking.find({ orgId, startAt: { $gte: now }, status: { $in: ['pending', 'confirmed'] } })
      .sort({ startAt: 1 })
      .limit(5)
      .populate('hostIds', 'name avatarColor timezone')
      .lean(),
    Booking.countDocuments({
      orgId,
      startAt: { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) },
      status: { $in: ['pending', 'confirmed'] },
    }),
    Booking.aggregate([
      { $match: { orgId } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { orgId, status: { $in: ['confirmed', 'pending'] } } },
      { $group: { _id: '$eventTitle', n: { $sum: 1 }, minutes: { $sum: '$durationMinutes' } } },
      { $sort: { n: -1 } },
      { $limit: 5 },
    ]),
    Booking.aggregate([
      { $match: { orgId, createdAt: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    // Where bookings come from, geographically. A genuinely useful signal for
    // deciding whether the working day is pointed at the right hemisphere.
    Booking.aggregate([
      { $match: { orgId, status: { $in: ['confirmed', 'pending'] } } },
      { $group: { _id: '$bookerTimezone', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 6 },
    ]),
  ]);

  const statusCounts = Object.fromEntries(totals.map((t) => [t._id, t.n]));
  const confirmed = (statusCounts.confirmed || 0) + (statusCounts.pending || 0);
  const cancelled = statusCounts.cancelled || 0;

  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const hit = daily.find((x) => x._id === key);
    days.push({
      date: key,
      label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      n: hit ? hit.n : 0,
    });
  }

  const minutesBooked = byEvent.reduce((sum, e) => sum + e.minutes, 0);

  res.json({
    cards: {
      thisWeek,
      total: confirmed,
      cancelled,
      cancelRate: confirmed + cancelled > 0 ? Math.round((cancelled / (confirmed + cancelled)) * 100) : null,
      hoursBooked: Math.round((minutesBooked / 60) * 10) / 10,
    },
    next,
    days,
    byEvent: byEvent.map((e) => ({ title: e._id, count: e.n, hours: Math.round((e.minutes / 60) * 10) / 10 })),
    byZone: byZone.map((z) => ({
      timezone: z._id,
      count: z.n,
      offset: tz.formatOffset(tz.offsetAt(now, z._id)),
    })),
    viewerTimezone: req.user.timezone,
  });
});

module.exports = {
  listEventTypes,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType,
  getSchedule,
  updateSchedule,
  listBookings,
  cancelBooking,
  summary,
};
