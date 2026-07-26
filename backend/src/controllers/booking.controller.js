const mongoose = require('mongoose');
const EventType = require('../models/EventType');
const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Org = require('../models/Org');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const tz = require('../utils/tz');
const { computeAvailability, verifySlot } = require('../services/availability');
const { buildCalendar } = require('../services/ics');
const { sendBookingConfirmation, sendCancellation } = require('../services/mailer');
const env = require('../config/env');
const { getExternalBusyIntervals } = require('../services/externalCalendar');

/** Loads everything the engine needs: the event, its hosts, their schedules, and the diary. */
async function loadContext(orgSlug, eventSlug, rangeStart, rangeEnd) {
  const org = await Org.findOne({ slug: orgSlug }).lean();
  if (!org) throw ApiError.notFound('No such page');

  const eventType = await EventType.findOne({ orgId: org._id, slug: eventSlug, active: true }).lean();
  if (!eventType) throw ApiError.notFound('That booking page does not exist');

  const users = await User.find({ _id: { $in: eventType.hostIds } }).lean();
  if (users.length === 0) throw ApiError.badRequest('This event type has no hosts');

  const schedules = await Schedule.find({ userId: { $in: eventType.hostIds } }).lean();
  const scheduleByUser = new Map(schedules.map((s) => [String(s.userId), s]));

  const hosts = users.map((user) => ({
    user,
    schedule: scheduleByUser.get(String(user._id)) || {
      weekly: Schedule.nineToFive(),
      overrides: [],
    },
  }));

  // Pad the diary query so a booking that starts just outside the window but runs
  // into it still blocks correctly.
  const bookings = await Booking.find({
    orgId: org._id,
    hostIds: { $in: eventType.hostIds },
    status: { $in: ['pending', 'confirmed'] },
    startAt: { $gte: rangeStart, $lte: rangeEnd },
  }).lean();

  // Load external busy blocks for connected calendars
  const externalBookings = [];
  for (const hostUser of users) {
    if (
      (hostUser.googleCalendar && hostUser.googleCalendar.connected) ||
      (hostUser.outlookCalendar && hostUser.outlookCalendar.connected)
    ) {
      try {
        const busyList = await getExternalBusyIntervals(hostUser, rangeStart, rangeEnd);
        for (const item of busyList) {
          externalBookings.push({
            status: 'confirmed',
            hostIds: [hostUser._id],
            startAt: new Date(item.start),
            endAt: new Date(item.end),
          });
        }
      } catch (err) {
        console.error(`[loadContext] Failed to load external busy times for host ${hostUser._id}:`, err.message);
      }
    }
  }

  const combinedBookings = [...bookings, ...externalBookings];

  return { org, eventType, hosts, bookings: combinedBookings };
}

/** Public: the booking page's own metadata. */
const getPublicEventType = asyncHandler(async (req, res) => {
  const org = await Org.findOne({ slug: req.params.orgSlug }).lean();
  if (!org) throw ApiError.notFound('No such page');

  const eventType = await EventType.findOne({ orgId: org._id, slug: req.params.eventSlug, active: true }).lean();
  if (!eventType) throw ApiError.notFound('That booking page does not exist');

  const hosts = await User.find({ _id: { $in: eventType.hostIds } })
    .select('name title timezone avatarColor')
    .lean();

  res.json({
    org: { name: org.name, slug: org.slug },
    eventType: {
      id: String(eventType._id),
      title: eventType.title,
      slug: eventType.slug,
      description: eventType.description,
      color: eventType.color,
      durationMinutes: eventType.durationMinutes,
      location: eventType.location,
      questions: eventType.questions,
      assignment: eventType.assignment,
      maximumAdvanceDays: eventType.maximumAdvanceDays,
      minimumNoticeMinutes: eventType.minimumNoticeMinutes,
    },
    hosts: hosts.map((h) => ({
      id: String(h._id),
      name: h.name,
      title: h.title,
      timezone: h.timezone,
      avatarColor: h.avatarColor,
    })),
  });
});

/** Public: the slot grid. The engine's front door. */
const getAvailability = asyncHandler(async (req, res) => {
  const { from, to, timezone } = req.validatedQuery;

  if (tz.addDaysToKey(from, 62) < to) {
    throw ApiError.badRequest('Ask for at most two months at a time');
  }

  // Widen by two days each side so cross-zone edges resolve.
  const rangeStart = new Date(`${tz.addDaysToKey(from, -2)}T00:00:00.000Z`);
  const rangeEnd = new Date(`${tz.addDaysToKey(to, 2)}T23:59:59.999Z`);

  const { eventType, hosts, bookings } = await loadContext(
    req.params.orgSlug,
    req.params.eventSlug,
    rangeStart,
    rangeEnd
  );

  const result = computeAvailability({
    eventType,
    hosts,
    bookings,
    fromKey: from,
    toKey: to,
    bookerTimezone: timezone,
    now: new Date(),
  });

  res.json(result);
});

/**
 * Public: take a slot.
 *
 * Three guards, in order:
 *   1. Recompute availability -- the page the browser is looking at is already stale.
 *   2. Write with a uniqueness constraint on (host, startAt) so two simultaneous
 *      requests cannot both win.
 *   3. Translate the resulting duplicate-key error into a human sentence.
 */
const createBooking = asyncHandler(async (req, res) => {
  const { startAt, timezone, name, email, notes, answers } = req.body;

  const around = new Date(startAt);
  const rangeStart = new Date(around.getTime() - 3 * 86400000);
  const rangeEnd = new Date(around.getTime() + 3 * 86400000);

  const { org, eventType, hosts, bookings } = await loadContext(
    req.params.orgSlug,
    req.params.eventSlug,
    rangeStart,
    rangeEnd
  );

  for (const question of eventType.questions || []) {
    if (question.required && !answers?.[question.key]?.trim()) {
      throw ApiError.badRequest(`"${question.label}" is required`);
    }
  }

  const check = verifySlot({ eventType, hosts, bookings, startAt, now: new Date() });
  if (!check.ok) throw ApiError.conflict(check.reason);

  // Round robin: give it to whoever is carrying the lightest load, so one host
  // does not absorb every booking simply by being first in the array.
  let assignedHostIds = check.hostIds;
  if (eventType.assignment === 'roundRobin' && check.hostIds.length > 1) {
    const counts = await Booking.aggregate([
      { $match: { orgId: org._id, status: { $in: ['pending', 'confirmed'] } } },
      { $unwind: '$hostIds' },
      { $group: { _id: '$hostIds', n: { $sum: 1 } } },
    ]);
    const load = new Map(counts.map((c) => [String(c._id), c.n]));
    assignedHostIds = [
      check.hostIds.slice().sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0))[0],
    ];
  }

  const hostUsers = hosts.filter((h) => assignedHostIds.includes(String(h.user._id))).map((h) => h.user);

  let booking;
  try {
    booking = await Booking.create({
      orgId: org._id,
      eventTypeId: eventType._id,
      eventTitle: eventType.title,
      hostIds: assignedHostIds,
      startAt: around,
      endAt: check.endAt,
      durationMinutes: eventType.durationMinutes,
      hostTimezone: hostUsers[0].timezone,
      bookerTimezone: timezone,
      attendee: { name, email, notes },
      answers: answers || {},
      status: eventType.requiresConfirmation ? 'pending' : 'confirmed',
      location: eventType.location,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('Someone just took that slot. Pick another time.');
    }
    throw err;
  }

  if (booking.location && booking.location.type === 'video') {
    const { createCalendarEventAndMeeting } = require('../services/videoMeeting');
    try {
      const meetingUrl = await createCalendarEventAndMeeting(booking, hostUsers[0]);
      booking.location.detail = meetingUrl;
      await booking.save();
    } catch (err) {
      console.error('[createBooking] Failed to generate meeting link:', err.message);
    }
  }

  const manageUrl = `${env.clientOrigin}/booking/${booking.manageToken}`;
  const ics = buildCalendar({
    booking: { ...booking.toObject(), manageUrl },
    hosts: hostUsers,
    organizerEmail: hostUsers[0].email,
  });

  // Email must never take the booking down with it.
  sendBookingConfirmation({ booking, hosts: hostUsers, icsContent: ics, manageUrl }).catch((err) =>
    console.error('confirmation email failed', err.message)
  );

  res.status(201).json({
    booking: {
      id: String(booking._id),
      manageToken: booking.manageToken,
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: booking.status,
      eventTitle: booking.eventTitle,
      bookerTimezone: booking.bookerTimezone,
      hostTimezone: booking.hostTimezone,
    },
    hosts: hostUsers.map((h) => ({ name: h.name, timezone: h.timezone })),
    manageUrl,
  });
});

/* ---------- managing a booking without an account ---------- */

async function loadByToken(token) {
  const booking = await Booking.findOne({ manageToken: token });
  if (!booking) throw ApiError.notFound('That booking link is not valid');
  const hosts = await User.find({ _id: { $in: booking.hostIds } }).lean();
  return { booking, hosts };
}

const getByToken = asyncHandler(async (req, res) => {
  const { booking, hosts } = await loadByToken(req.params.token);
  const eventType = await EventType.findById(booking.eventTypeId).lean();
  const org = await Org.findById(booking.orgId).lean();

  res.json({
    booking: {
      id: String(booking._id),
      eventTitle: booking.eventTitle,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      status: booking.status,
      attendee: booking.attendee,
      answers: booking.answers,
      location: booking.location,
      bookerTimezone: booking.bookerTimezone,
      hostTimezone: booking.hostTimezone,
      cancelReason: booking.cancelReason,
      manageToken: booking.manageToken,
    },
    hosts: hosts.map((h) => ({ name: h.name, timezone: h.timezone, avatarColor: h.avatarColor })),
    org: org && { name: org.name, slug: org.slug },
    eventSlug: eventType?.slug,
  });
});

const cancelByToken = asyncHandler(async (req, res) => {
  const { booking, hosts } = await loadByToken(req.params.token);
  if (booking.status === 'cancelled') throw ApiError.badRequest('That booking is already cancelled');
  if (new Date(booking.startAt) < new Date()) throw ApiError.badRequest('That booking has already happened');

  booking.status = 'cancelled';
  booking.cancelReason = req.body.reason;
  booking.cancelledBy = 'attendee';
  await booking.save();

  sendCancellation({ booking, hosts, reason: req.body.reason, cancelledBy: 'attendee' }).catch((err) =>
    console.error('cancellation email failed', err.message)
  );

  res.json({ ok: true });
});

/**
 * Reschedule is a cancel plus a create, linked by rescheduledFromId.
 * Keeping the original record rather than mutating it preserves the history --
 * "this moved twice" is a thing support teams genuinely need to see.
 */
const rescheduleByToken = asyncHandler(async (req, res) => {
  const { booking } = await loadByToken(req.params.token);
  if (booking.status === 'cancelled') throw ApiError.badRequest('That booking was cancelled');

  const org = await Org.findById(booking.orgId).lean();
  const eventType = await EventType.findById(booking.eventTypeId).lean();
  if (!eventType) throw ApiError.notFound('That event type no longer exists');

  const around = new Date(req.body.startAt);
  const users = await User.find({ _id: { $in: eventType.hostIds } }).lean();
  const schedules = await Schedule.find({ userId: { $in: eventType.hostIds } }).lean();
  const scheduleByUser = new Map(schedules.map((s) => [String(s.userId), s]));
  const hosts = users.map((user) => ({
    user,
    schedule: scheduleByUser.get(String(user._id)) || { weekly: Schedule.nineToFive(), overrides: [] },
  }));

  const bookings = await Booking.find({
    orgId: org._id,
    hostIds: { $in: eventType.hostIds },
    status: { $in: ['pending', 'confirmed'] },
    startAt: { $gte: new Date(around.getTime() - 3 * 86400000), $lte: new Date(around.getTime() + 3 * 86400000) },
    // Its own slot must not block its own move.
    _id: { $ne: booking._id },
  }).lean();

  const check = verifySlot({ eventType, hosts, bookings, startAt: req.body.startAt, now: new Date() });
  if (!check.ok) throw ApiError.conflict(check.reason);

  const hostUsers = hosts.filter((h) => check.hostIds.includes(String(h.user._id))).map((h) => h.user);

  // Create the new booking first. If this fails, the original booking remains confirmed and untouched.
  const moved = await Booking.create({
    orgId: booking.orgId,
    eventTypeId: booking.eventTypeId,
    eventTitle: booking.eventTitle,
    hostIds: check.hostIds,
    startAt: around,
    endAt: check.endAt,
    durationMinutes: eventType.durationMinutes,
    hostTimezone: hostUsers[0].timezone,
    bookerTimezone: req.body.timezone,
    attendee: booking.attendee,
    answers: booking.answers,
    status: 'confirmed',
    location: booking.location,
    rescheduledFromId: booking._id,
  });

  if (moved.location && moved.location.type === 'video') {
    const { createCalendarEventAndMeeting } = require('../services/videoMeeting');
    try {
      const meetingUrl = await createCalendarEventAndMeeting(moved, hostUsers[0]);
      moved.location.detail = meetingUrl;
      await moved.save();
    } catch (err) {
      console.error('[rescheduleByToken] Failed to generate meeting link:', err.message);
    }
  }

  try {
    booking.status = 'rescheduled';
    await booking.save();
  } catch (err) {
    // Software-level rollback: if marking the original booking as rescheduled fails,
    // delete the newly created booking to restore system consistency.
    await Booking.deleteOne({ _id: moved._id });
    throw err;
  }

  const manageUrl = `${env.clientOrigin}/booking/${moved.manageToken}`;
  const ics = buildCalendar({
    booking: { ...moved.toObject(), manageUrl },
    hosts: hostUsers,
    organizerEmail: hostUsers[0].email,
  });
  sendBookingConfirmation({ booking: moved, hosts: hostUsers, icsContent: ics, manageUrl }).catch((err) =>
    console.error('reschedule email failed', err.message)
  );

  res.json({ booking: { id: String(moved._id), manageToken: moved.manageToken, startAt: moved.startAt }, manageUrl });
});

/** The .ics download. Same file the confirmation email attaches. */
const downloadIcs = asyncHandler(async (req, res) => {
  const { booking, hosts } = await loadByToken(req.params.token);
  const ics = buildCalendar({
    booking: { ...booking.toObject(), manageUrl: `${env.clientOrigin}/booking/${booking.manageToken}` },
    hosts,
    organizerEmail: hosts[0]?.email,
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="booking.ics"');
  res.send(ics);
});

module.exports = {
  getPublicEventType,
  getAvailability,
  createBooking,
  getByToken,
  cancelByToken,
  rescheduleByToken,
  downloadIcs,
};
