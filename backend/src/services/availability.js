const tz = require('../utils/tz');
const intervals = require('../utils/intervals');

const MS_MINUTE = 60 * 1000;

/**
 * THE AVAILABILITY ENGINE.
 *
 * Turning "I work 9 to 5" into "here are the times you can book" is deceptively
 * hard, because three separate clocks are involved and none of them agree:
 *
 *   1. The host's rules live in WALL TIME in the host's zone. 09:00 stays 09:00
 *      through a daylight-saving change; the UTC instant it points at does not.
 *   2. Bookings live in UTC, because that is the only frame that is unambiguous.
 *   3. The booker reads the result in THEIR zone, where the day boundaries fall
 *      somewhere else entirely -- a Tokyo booker's Tuesday morning is a New York
 *      host's Monday evening.
 *
 * So the pipeline is: expand rules to UTC intervals in the host's zone, do all the
 * set algebra in UTC, then bucket the results into days in the booker's zone.
 */

/**
 * A host's raw working intervals as UTC instants, before anything is subtracted.
 *
 * Iterating by DATE KEY rather than by adding 24h avoids the classic bug: on a
 * spring-forward day the local day is 23 hours long, so stepping by a fixed 86400s
 * silently drifts an hour off and every subsequent day is wrong.
 */
function workingIntervals(schedule, timezone, fromKey, toKey) {
  const out = [];
  const overrideByDate = new Map((schedule.overrides || []).map((o) => [o.date, o]));

  let key = fromKey;
  let guard = 0;
  while (key <= toKey && guard < 800) {
    guard += 1;
    const override = overrideByDate.get(key);
    // An override with no windows is a closure -- a holiday. That is meaningfully
    // different from "no override", which falls through to the weekly pattern.
    const windows = override ? override.windows : schedule.weekly[tz.weekdayOfKey(key)] || [];

    const { year, month, day } = tz.parseDateKey(key);
    for (const window of windows) {
      if (window.end <= window.start) continue;
      const start = tz.zonedToUtc(
        { year, month, day, hour: Math.floor(window.start / 60), minute: window.start % 60 },
        timezone
      );
      // End is expressed as minutes from the SAME local midnight, so a window
      // ending at 24:00 resolves correctly even on a 23- or 25-hour day.
      const end = tz.zonedToUtc(
        { year, month, day, hour: Math.floor(window.end / 60), minute: window.end % 60 },
        timezone
      );
      if (end.getTime() > start.getTime()) {
        out.push({ start: start.getTime(), end: end.getTime() });
      }
    }

    key = tz.addDaysToKey(key, 1);
  }

  return intervals.merge(out);
}

/**
 * Existing bookings as blocked intervals, expanded by the event's buffers.
 *
 * A 10:00-10:30 call with 10-minute buffers occupies 09:50-10:40, so the engine
 * will not offer anything that runs into the padding on either side.
 */
function busyIntervals(bookings, hostId, bufferBefore, bufferAfter) {
  return intervals.merge(
    bookings
      .filter(
        (b) =>
          (b.status === 'confirmed' || b.status === 'pending') &&
          (!hostId || b.hostIds.some((id) => String(id) === String(hostId)))
      )
      .map((b) => ({
        start: new Date(b.startAt).getTime() - bufferBefore * MS_MINUTE,
        end: new Date(b.endAt).getTime() + bufferAfter * MS_MINUTE,
      }))
  );
}

/**
 * Working hours and free time for one host.
 *
 * Both are returned because they play different roles: `working` anchors the slot
 * grid, `free` decides which of those grid positions are actually bookable. See
 * the note in computeAvailability for why that separation matters.
 */
function hostIntervals({ host, schedule, bookings, eventType, fromKey, toKey }) {
  const working = workingIntervals(schedule, host.timezone, fromKey, toKey);
  const busy = busyIntervals(
    bookings,
    host._id,
    eventType.bufferBeforeMinutes || 0,
    eventType.bufferAfterMinutes || 0
  );
  return { working, free: intervals.subtract(working, busy) };
}

/** Convenience wrapper for callers that only care about free time. */
function freeIntervalsForHost(args) {
  return hostIntervals(args).free;
}

/**
 * Step a free interval on the slot grid.
 *
 * The grid is anchored to the START OF THE WINDOW, not to the top of the hour, so
 * a host whose day starts at 08:50 gets 08:50, 09:05, 09:20 rather than losing the
 * first ten minutes. A slot must fit entirely inside its window.
 */
function slotsInInterval(interval, durationMinutes, incrementMinutes) {
  const out = [];
  const duration = durationMinutes * MS_MINUTE;
  const step = Math.max(incrementMinutes, 1) * MS_MINUTE;

  for (let start = interval.start; start + duration <= interval.end; start += step) {
    out.push({ start, end: start + duration });
  }
  return out;
}

/**
 * The public entry point.
 *
 * Returns days bucketed in the BOOKER's timezone, each carrying its slots plus a
 * note if the clocks change on that day in either zone.
 */
function computeAvailability({
  eventType,
  hosts, // [{ user, schedule }]
  bookings,
  fromKey, // 'YYYY-MM-DD' in booker's zone
  toKey,
  bookerTimezone,
  now = new Date(),
}) {
  if (!hosts.length) return { days: [], timezone: bookerTimezone };

  const duration = eventType.durationMinutes;
  const increment = eventType.slotIncrementMinutes || 15;

  // Widen the host-side scan by a day at each end: a booker's Monday can contain
  // the host's Sunday night or Tuesday morning, depending on the offset between them.
  const scanFrom = tz.addDaysToKey(fromKey, -1);
  const scanTo = tz.addDaysToKey(toKey, 1);

  const perHost = hosts.map(({ user, schedule }) => {
    const { working, free } = hostIntervals({
      host: user,
      schedule,
      bookings,
      eventType,
      fromKey: scanFrom,
      toKey: scanTo,
    });
    return { user, working, free };
  });

  /**
   * The slot grid is anchored to the WORKING window, not to the free gaps left
   * over after bookings are removed.
   *
   * That distinction is the difference between a calendar people trust and one
   * they do not. Anchor to the free gaps and a single 12:00 booking drags the
   * entire afternoon off the clock -- the customer is offered 12:45, 13:15, 13:45
   * instead of 13:00, 13:30, 14:00. Technically those are all available. It still
   * looks broken, and it makes two bookings on the same day impossible to read.
   *
   * So: generate candidate times from the working window, then keep only the ones
   * that survive the free-time check.
   */
  let gridIntervals;
  if (eventType.assignment === 'collective') {
    // Collective needs everyone simultaneously, so both grid and freedom intersect.
    gridIntervals = intervals.intersectAll(perHost.map((h) => h.working));
  } else {
    gridIntervals = intervals.merge(perHost.flatMap((h) => h.working));
  }

  const earliest = now.getTime() + (eventType.minimumNoticeMinutes || 0) * MS_MINUTE;
  const latest = now.getTime() + (eventType.maximumAdvanceDays || 60) * 24 * 60 * MS_MINUTE;

  // Daily caps are counted in the HOST's zone -- it's their day that fills up.
  const primaryZone = hosts[0].user.timezone;
  const perDayCount = new Map();
  if (eventType.maxBookingsPerDay > 0) {
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue;
      const key = tz.dateKeyInZone(booking.startAt, primaryZone);
      perDayCount.set(key, (perDayCount.get(key) || 0) + 1);
    }
  }

  const byDay = new Map();

  for (const interval of gridIntervals) {
    for (const slot of slotsInInterval(interval, duration, increment)) {
      if (slot.start < earliest || slot.start > latest) continue;

      if (eventType.maxBookingsPerDay > 0) {
        const hostDay = tz.dateKeyInZone(new Date(slot.start), primaryZone);
        if ((perDayCount.get(hostDay) || 0) >= eventType.maxBookingsPerDay) continue;
      }

      // Which hosts can actually take this one. For round-robin this is the pool
      // the booking controller load-balances across.
      const availableHosts = perHost
        .filter((h) => h.free.some((f) => intervals.contains(f, slot)))
        .map((h) => h.user);

      if (eventType.assignment === 'collective' && availableHosts.length !== hosts.length) continue;
      if (availableHosts.length === 0) continue;

      const bookerKey = tz.dateKeyInZone(new Date(slot.start), bookerTimezone);
      if (bookerKey < fromKey || bookerKey > toKey) continue;

      if (!byDay.has(bookerKey)) byDay.set(bookerKey, []);
      byDay.get(bookerKey).push({
        startAt: new Date(slot.start).toISOString(),
        endAt: new Date(slot.end).toISOString(),
        hostIds: availableHosts.map((u) => String(u._id)),
      });
    }
  }

  const days = [];
  let key = fromKey;
  let guard = 0;
  while (key <= toKey && guard < 400) {
    guard += 1;
    const slots = (byDay.get(key) || []).sort((a, b) => a.startAt.localeCompare(b.startAt));
    days.push({
      date: key,
      weekday: tz.weekdayOfKey(key),
      slots,
      // Surfacing the transition is the difference between a booking tool people
      // trust twice a year and one they quietly stop trusting.
      dstShift: tz.dstShiftOnDay(key, bookerTimezone),
      hostDstShift: tz.dstShiftOnDay(key, primaryZone),
    });
    key = tz.addDaysToKey(key, 1);
  }

  return {
    days,
    timezone: bookerTimezone,
    hostTimezone: primaryZone,
    assignment: eventType.assignment,
  };
}

/**
 * Re-check a single slot at the moment of booking.
 *
 * The list the browser is looking at was computed seconds or minutes ago, and
 * somebody else may have taken this exact time in between. Never trust the slot
 * the client posts -- recompute it.
 */
function verifySlot({ eventType, hosts, bookings, startAt, now = new Date() }) {
  const start = new Date(startAt).getTime();
  if (Number.isNaN(start)) return { ok: false, reason: 'That is not a valid time' };

  const end = start + eventType.durationMinutes * MS_MINUTE;

  if (start < now.getTime() + (eventType.minimumNoticeMinutes || 0) * MS_MINUTE) {
    return { ok: false, reason: 'That time is too soon to book now' };
  }
  if (start > now.getTime() + (eventType.maximumAdvanceDays || 60) * 24 * 60 * MS_MINUTE) {
    return { ok: false, reason: 'That time is further ahead than this calendar opens' };
  }

  // Grid alignment: the slot has to be one we would actually have offered.
  const scanKey = tz.dateKeyInZone(new Date(start), hosts[0].user.timezone);
  const free = hosts.map(({ user, schedule }) => ({
    user,
    intervals: freeIntervalsForHost({
      host: user,
      schedule,
      bookings,
      eventType,
      fromKey: tz.addDaysToKey(scanKey, -1),
      toKey: tz.addDaysToKey(scanKey, 1),
    }),
  }));

  const slot = { start, end };
  const availableHosts = free.filter((h) => h.intervals.some((f) => intervals.contains(f, slot)));

  if (eventType.assignment === 'collective') {
    if (availableHosts.length !== hosts.length) {
      return { ok: false, reason: 'Not everyone is free then any more' };
    }
    return { ok: true, hostIds: hosts.map((h) => String(h.user._id)), endAt: new Date(end) };
  }

  if (availableHosts.length === 0) {
    return { ok: false, reason: 'That slot was taken while you were filling in the form' };
  }

  return {
    ok: true,
    hostIds: availableHosts.map((h) => String(h.user._id)),
    endAt: new Date(end),
  };
}

module.exports = {
  computeAvailability,
  verifySlot,
  workingIntervals,
  busyIntervals,
  hostIntervals,
  freeIntervalsForHost,
  slotsInInterval,
};
