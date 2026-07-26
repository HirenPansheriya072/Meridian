/**
 * Timezone primitives.
 *
 * Everything in this app is stored as a UTC instant. But availability rules are
 * written in WALL TIME -- "I work 9 to 5" means 9am where the host is sitting, and
 * that is a different UTC instant in January than it is in July.
 *
 * So the app constantly converts between three frames:
 *   - the host's zone, where the rules live
 *   - UTC, where the data lives
 *   - the booker's zone, where the result is read
 *
 * These are built on Intl, which carries the IANA database in Node, rather than on
 * a date library. A production team would reasonably reach for date-fns-tz or
 * Luxon; this is deliberately hand-rolled and heavily tested because the
 * conversion IS the hard part of the product, not an incidental dependency.
 */

const MINUTE = 60 * 1000;

/**
 * Offset of a zone from UTC, in minutes, AT A GIVEN INSTANT.
 * Positive means ahead of UTC (Berlin +60), negative means behind (New York -300).
 *
 * The offset must be sampled at an instant, never assumed: the whole point is that
 * it changes twice a year.
 */
function offsetAt(instant, timeZone) {
  const date = instant instanceof Date ? instant : new Date(instant);

  // Read the wall-clock parts this instant shows in the target zone, then compare
  // that back against UTC. The gap is the offset.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }

  // Intl renders midnight as hour 24 in some engines. Normalise it.
  const hour = parts.hour === 24 ? 0 : parts.hour;

  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second);
  // Drop sub-second noise before differencing.
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE);
}

/**
 * Wall time in a zone -> the UTC instant it refers to.
 *
 * Two passes, because the offset we need depends on the answer we are computing.
 * Guess with the offset at the naive instant, then re-sample at the corrected one:
 * that second pass is what gets DST-transition days right.
 *
 * Note the ambiguity built into the calendar itself:
 *   - Spring forward: 02:30 does not exist. We return the instant the clock jumps to.
 *   - Autumn back: 01:30 happens twice. We return the FIRST (pre-transition) one,
 *     which is the convention every major calendar app uses.
 */
function zonedToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  let instant = naive - offsetAt(new Date(naive), timeZone) * MINUTE;
  instant = naive - offsetAt(new Date(instant), timeZone) * MINUTE;

  return new Date(instant);
}

/** UTC instant -> the wall-clock parts it shows in a zone. */
function utcToZoned(instant, timeZone) {
  const date = instant instanceof Date ? instant : new Date(instant);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
    minutesIntoDay: hour * 60 + Number(parts.minute),
  };
}

/** 'YYYY-MM-DD' as it reads in a zone. The key we bucket slots by. */
function dateKeyInZone(instant, timeZone) {
  const z = utcToZoned(instant, timeZone);
  return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`;
}

function parseDateKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Bad date key: ${key}`);
  return { year, month, day };
}

/** Walk date keys forward without ever touching a Date -- no DST drift possible. */
function addDaysToKey(key, days) {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

function weekdayOfKey(key) {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** '09:30' -> 570. Availability rules are stored as these minute offsets. */
function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) throw new Error(`Bad time: ${value}. Use HH:MM.`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) throw new Error(`Out of range time: ${value}`);
  return hours * 60 + minutes;
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Does a day contain a DST transition in this zone?
 *
 * Used to warn people, and to explain why a 9-to-5 day can be 23 or 25 hours long.
 * Comparing the offset at the day's start and end catches every real transition.
 */
function dstShiftOnDay(dateKey, timeZone) {
  const { year, month, day } = parseDateKey(dateKey);
  const start = zonedToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone);
  const end = new Date(start.getTime() + 24 * 60 * MINUTE);

  const before = offsetAt(start, timeZone);
  const after = offsetAt(end, timeZone);

  if (before === after) return null;
  return {
    minutes: after - before,
    direction: after > before ? 'forward' : 'back',
    from: before,
    to: after,
  };
}

/** '+05:30', for display next to a zone name. */
function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  MINUTE,
  offsetAt,
  zonedToUtc,
  utcToZoned,
  dateKeyInZone,
  parseDateKey,
  addDaysToKey,
  weekdayOfKey,
  parseClock,
  formatClock,
  dstShiftOnDay,
  formatOffset,
  isValidTimeZone,
};
