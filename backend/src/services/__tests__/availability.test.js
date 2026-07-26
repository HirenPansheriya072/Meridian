/**
 * Availability engine tests.
 *
 * These are the ones that matter. A scheduling bug does not throw an exception --
 * it quietly offers a slot that is already taken, or hides a morning that was free,
 * and nobody notices until a customer turns up to an empty video call.
 */
const { computeAvailability, verifySlot } = require('../availability');
const intervals = require('../../utils/intervals');
const tz = require('../../utils/tz');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ok    ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
  }
}

/* ---------- fixtures ---------- */

const NINE_TO_FIVE = [[], [{ start: 540, end: 1020 }], [{ start: 540, end: 1020 }], [{ start: 540, end: 1020 }], [{ start: 540, end: 1020 }], [{ start: 540, end: 1020 }], []];

const host = (id, timezone, weekly = NINE_TO_FIVE, overrides = []) => ({
  user: { _id: id, timezone, name: id },
  schedule: { weekly, overrides },
});

const eventType = (patch = {}) => ({
  durationMinutes: 30,
  slotIncrementMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: 0,
  maximumAdvanceDays: 365,
  maxBookingsPerDay: 0,
  assignment: 'single',
  ...patch,
});

const booking = (startIso, minutes, hostIds, status = 'confirmed') => ({
  startAt: new Date(startIso),
  endAt: new Date(new Date(startIso).getTime() + minutes * 60000),
  hostIds,
  status,
});

// A fixed "now" well before every test window, so nothing is filtered by notice.
const NOW = new Date('2025-06-01T00:00:00Z');
const dayOf = (result, date) => result.days.find((d) => d.date === date);

/* ---------- interval algebra ---------- */

console.log('\nintervals: the algebra underneath everything');
check(
  'merge collapses overlaps',
  JSON.stringify(intervals.merge([{ start: 0, end: 10 }, { start: 5, end: 15 }])) ===
    JSON.stringify([{ start: 0, end: 15 }])
);
check(
  'merge joins touching intervals',
  intervals.merge([{ start: 0, end: 10 }, { start: 10, end: 20 }]).length === 1
);
check(
  'merge leaves a gap alone',
  intervals.merge([{ start: 0, end: 10 }, { start: 20, end: 30 }]).length === 2
);
check(
  'subtract punches a hole in the middle',
  JSON.stringify(intervals.subtract([{ start: 0, end: 100 }], [{ start: 40, end: 60 }])) ===
    JSON.stringify([{ start: 0, end: 40 }, { start: 60, end: 100 }])
);
check(
  'subtract removes a fully covered interval',
  intervals.subtract([{ start: 10, end: 20 }], [{ start: 0, end: 100 }]).length === 0
);
check(
  'subtract ignores a non-overlapping blocker',
  intervals.subtract([{ start: 0, end: 10 }], [{ start: 20, end: 30 }]).length === 1
);
check(
  'intersect finds the shared middle',
  JSON.stringify(intervals.intersect([{ start: 0, end: 50 }], [{ start: 30, end: 80 }])) ===
    JSON.stringify([{ start: 30, end: 50 }])
);
check('intersect of disjoint sets is empty', intervals.intersect([{ start: 0, end: 10 }], [{ start: 20, end: 30 }]).length === 0);
check(
  'intersectAll across three sets',
  JSON.stringify(
    intervals.intersectAll([
      [{ start: 0, end: 100 }],
      [{ start: 20, end: 80 }],
      [{ start: 40, end: 60 }],
    ])
  ) === JSON.stringify([{ start: 40, end: 60 }])
);
check(
  'touching intervals do not count as overlapping',
  !intervals.overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })
);

/* ---------- the basics ---------- */

console.log('\nengine: a plain week');
const basic = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'America/New_York')],
  bookings: [],
  fromKey: '2025-06-02', // Monday
  toKey: '2025-06-08', // Sunday
  bookerTimezone: 'America/New_York',
  now: NOW,
});

check('returns seven days', basic.days.length === 7);
check('Monday 9-5 with 30-min slots gives 16', dayOf(basic, '2025-06-02').slots.length === 16);
check('the first slot is 9am local', tz.utcToZoned(dayOf(basic, '2025-06-02').slots[0].startAt, 'America/New_York').hour === 9);
check(
  'the last slot starts at 4:30pm, not 5',
  tz.utcToZoned(dayOf(basic, '2025-06-02').slots[15].startAt, 'America/New_York').minutesIntoDay === 16 * 60 + 30
);
check('Saturday is closed', dayOf(basic, '2025-06-07').slots.length === 0);
check('Sunday is closed', dayOf(basic, '2025-06-08').slots.length === 0);

console.log('\nengine: slot grid');
const fifteen = computeAvailability({
  eventType: eventType({ durationMinutes: 30, slotIncrementMinutes: 15 }),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('a 15-min grid on a 30-min call gives 31 slots in 8 hours', dayOf(fifteen, '2025-06-02').slots.length === 31);

const hourLong = computeAvailability({
  eventType: eventType({ durationMinutes: 60, slotIncrementMinutes: 60 }),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('an hour-long call in an 8 hour day gives 8 slots', dayOf(hourLong, '2025-06-02').slots.length === 8);

/* ---------- bookings and buffers ---------- */

console.log('\nengine: existing bookings');
const withBooking = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [booking('2025-06-02T10:00:00Z', 30, ['h1'])],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('a booked slot disappears', dayOf(withBooking, '2025-06-02').slots.length === 15);
check(
  'the exact booked time is not offered',
  !dayOf(withBooking, '2025-06-02').slots.some((s) => s.startAt === '2025-06-02T10:00:00.000Z')
);
check(
  'the slot right after it is still offered',
  dayOf(withBooking, '2025-06-02').slots.some((s) => s.startAt === '2025-06-02T10:30:00.000Z')
);

const cancelled = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [booking('2025-06-02T10:00:00Z', 30, ['h1'], 'cancelled')],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('a cancelled booking frees its slot again', dayOf(cancelled, '2025-06-02').slots.length === 16);

console.log('\nengine: buffers');
const buffered = computeAvailability({
  eventType: eventType({ bufferBeforeMinutes: 15, bufferAfterMinutes: 15 }),
  hosts: [host('h1', 'UTC')],
  bookings: [booking('2025-06-02T12:00:00Z', 30, ['h1'])],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
const bufferedStarts = dayOf(buffered, '2025-06-02').slots.map((s) => s.startAt);
check('the booking itself is blocked', !bufferedStarts.includes('2025-06-02T12:00:00.000Z'));
check('the slot ending at the buffer edge is blocked', !bufferedStarts.includes('2025-06-02T11:30:00.000Z'));
check('the slot after the trailing buffer is blocked', !bufferedStarts.includes('2025-06-02T12:30:00.000Z'));
check('an hour before is still free', bufferedStarts.includes('2025-06-02T11:00:00.000Z'));
check('an hour after is still free', bufferedStarts.includes('2025-06-02T13:00:00.000Z'));

console.log('\nengine: the grid stays on the clock after a booking');
// Regression guard. Anchoring slots to the free gaps left after a booking drags
// the rest of the day off the hour -- 12:45, 13:15 instead of 13:00, 13:30.
// Every slot must sit on the increment grid measured from the start of the day.
const gridAfterBooking = computeAvailability({
  eventType: eventType({ bufferBeforeMinutes: 15, bufferAfterMinutes: 15 }),
  hosts: [host('h1', 'UTC')],
  bookings: [booking('2025-06-02T12:00:00Z', 30, ['h1'])],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
const gridStarts = dayOf(gridAfterBooking, '2025-06-02').slots.map((s) => s.startAt);
check('afternoon slots stay on the half hour', gridStarts.includes('2025-06-02T13:00:00.000Z'));
check('no off-grid slot is invented', !gridStarts.includes('2025-06-02T12:45:00.000Z'));
check(
  'every slot lands on the increment grid',
  dayOf(gridAfterBooking, '2025-06-02').slots.every(
    (s) => tz.utcToZoned(s.startAt, 'UTC').minutesIntoDay % 30 === 0
  )
);

const gridOddStart = computeAvailability({
  eventType: eventType({ slotIncrementMinutes: 15 }),
  hosts: [host('h1', 'UTC', [[], [{ start: 530, end: 1020 }], [], [], [], [], []])], // 08:50 start
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check(
  'a window starting at 08:50 anchors the grid there, not on the hour',
  dayOf(gridOddStart, '2025-06-02').slots[0].startAt === '2025-06-02T08:50:00.000Z'
);

/* ---------- notice and horizon ---------- */

console.log('\nengine: minimum notice and booking horizon');
const notice = computeAvailability({
  eventType: eventType({ minimumNoticeMinutes: 24 * 60 }),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-03',
  bookerTimezone: 'UTC',
  now: new Date('2025-06-02T08:00:00Z'),
});
check('same-day slots vanish under 24h notice', dayOf(notice, '2025-06-02').slots.length === 0);
check('tomorrow survives past the notice window', dayOf(notice, '2025-06-03').slots.length > 0);

const horizon = computeAvailability({
  eventType: eventType({ maximumAdvanceDays: 3 }),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-12',
  bookerTimezone: 'UTC',
  now: new Date('2025-06-02T00:00:00Z'),
});
check('a 3-day horizon closes the far end', dayOf(horizon, '2025-06-12').slots.length === 0);
check('the near end stays open', dayOf(horizon, '2025-06-03').slots.length > 0);

console.log('\nengine: daily cap');
const capped = computeAvailability({
  eventType: eventType({ maxBookingsPerDay: 2 }),
  hosts: [host('h1', 'UTC')],
  bookings: [
    booking('2025-06-02T09:00:00Z', 30, ['h1']),
    booking('2025-06-02T14:00:00Z', 30, ['h1']),
  ],
  fromKey: '2025-06-02',
  toKey: '2025-06-03',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('a day at its cap closes entirely', dayOf(capped, '2025-06-02').slots.length === 0);
check('the next day is unaffected', dayOf(capped, '2025-06-03').slots.length === 16);

/* ---------- overrides ---------- */

console.log('\nengine: date overrides');
const holiday = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'UTC', NINE_TO_FIVE, [{ date: '2025-06-03', label: 'Closed', windows: [] }])],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-04',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('an empty override closes the day', dayOf(holiday, '2025-06-03').slots.length === 0);
check('the day before is untouched', dayOf(holiday, '2025-06-02').slots.length === 16);
check('the day after is untouched', dayOf(holiday, '2025-06-04').slots.length === 16);

const shortDay = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'UTC', NINE_TO_FIVE, [{ date: '2025-06-03', windows: [{ start: 600, end: 720 }] }])],
  bookings: [],
  fromKey: '2025-06-03',
  toKey: '2025-06-03',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('a custom-hours override replaces the weekly rule', dayOf(shortDay, '2025-06-03').slots.length === 4);

const weekendOpen = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'UTC', NINE_TO_FIVE, [{ date: '2025-06-07', windows: [{ start: 600, end: 780 }] }])],
  bookings: [],
  fromKey: '2025-06-07',
  toKey: '2025-06-07',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('an override can open a normally closed Saturday', dayOf(weekendOpen, '2025-06-07').slots.length === 6);

/* ---------- multi-host ---------- */

console.log('\nengine: collective scheduling needs everyone');
const collective = computeAvailability({
  eventType: eventType({ assignment: 'collective' }),
  hosts: [
    host('h1', 'UTC', [[], [{ start: 540, end: 1020 }], [], [], [], [], []]), // 9-5
    host('h2', 'UTC', [[], [{ start: 780, end: 1020 }], [], [], [], [], []]), // 1-5
  ],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('collective yields only the overlap', dayOf(collective, '2025-06-02').slots.length === 8);
check(
  'collective starts when the later host starts',
  dayOf(collective, '2025-06-02').slots[0].startAt === '2025-06-02T13:00:00.000Z'
);
check('collective slots list both hosts', dayOf(collective, '2025-06-02').slots[0].hostIds.length === 2);

const collectiveBusy = computeAvailability({
  eventType: eventType({ assignment: 'collective' }),
  hosts: [host('h1', 'UTC'), host('h2', 'UTC')],
  bookings: [booking('2025-06-02T10:00:00Z', 30, ['h2'])],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('one busy host removes the collective slot', dayOf(collectiveBusy, '2025-06-02').slots.length === 15);

console.log('\nengine: round robin needs anyone');
const roundRobin = computeAvailability({
  eventType: eventType({ assignment: 'roundRobin' }),
  hosts: [
    host('h1', 'UTC', [[], [{ start: 540, end: 720 }], [], [], [], [], []]), // 9-12
    host('h2', 'UTC', [[], [{ start: 720, end: 1020 }], [], [], [], [], []]), // 12-5
  ],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
check('round robin covers the union of both', dayOf(roundRobin, '2025-06-02').slots.length === 16);
check(
  'a morning slot offers only the morning host',
  dayOf(roundRobin, '2025-06-02').slots[0].hostIds.length === 1 && dayOf(roundRobin, '2025-06-02').slots[0].hostIds[0] === 'h1'
);

const rrOneBusy = computeAvailability({
  eventType: eventType({ assignment: 'roundRobin' }),
  hosts: [host('h1', 'UTC'), host('h2', 'UTC')],
  bookings: [booking('2025-06-02T10:00:00Z', 30, ['h1'])],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'UTC',
  now: NOW,
});
const rrSlot = dayOf(rrOneBusy, '2025-06-02').slots.find((s) => s.startAt === '2025-06-02T10:00:00.000Z');
check('round robin keeps the slot when one host is busy', Boolean(rrSlot));
check('but only offers the free host', rrSlot.hostIds.length === 1 && rrSlot.hostIds[0] === 'h2');

/* ---------- timezones, the point of the whole thing ---------- */

console.log('\nengine: the host and the booker are in different zones');
const crossZone = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'America/New_York')],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-06',
  bookerTimezone: 'Asia/Tokyo',
  now: NOW,
});
// NY 9am-5pm EDT is 13:00-21:00 UTC, which is 22:00-06:00 the NEXT day in Tokyo.
const tokyoTue = dayOf(crossZone, '2025-06-03');
check('the booker sees slots on their own calendar days', tokyoTue.slots.length > 0);
check(
  'a Tokyo-Tuesday slot is really a New York Monday',
  tz.dateKeyInZone(tokyoTue.slots[0].startAt, 'America/New_York') === '2025-06-02'
);
check(
  'every offered slot is inside the host working day',
  crossZone.days.every((d) =>
    d.slots.every((s) => {
      const local = tz.utcToZoned(s.startAt, 'America/New_York');
      return local.minutesIntoDay >= 540 && local.minutesIntoDay < 1020;
    })
  )
);

console.log('\nengine: DST does not move the working day');
const springForward = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'America/New_York')],
  bookings: [],
  fromKey: '2025-03-07', // Friday before
  toKey: '2025-03-11', // Tuesday after
  bookerTimezone: 'America/New_York',
  now: new Date('2025-03-01T00:00:00Z'),
});
check('the Friday before the change has a full day', dayOf(springForward, '2025-03-07').slots.length === 16);
check('the Monday after the change has a full day', dayOf(springForward, '2025-03-10').slots.length === 16);
check(
  'the host still starts at 9am local on both sides',
  tz.utcToZoned(dayOf(springForward, '2025-03-07').slots[0].startAt, 'America/New_York').hour === 9 &&
    tz.utcToZoned(dayOf(springForward, '2025-03-10').slots[0].startAt, 'America/New_York').hour === 9
);
check(
  'but the UTC instant moved by an hour',
  dayOf(springForward, '2025-03-07').slots[0].startAt.slice(11, 16) === '14:00' &&
    dayOf(springForward, '2025-03-10').slots[0].startAt.slice(11, 16) === '13:00'
);
check('the transition day is flagged', dayOf(springForward, '2025-03-09')?.dstShift?.direction === 'forward');

const fallBack = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'America/New_York')],
  bookings: [],
  fromKey: '2025-10-31',
  toKey: '2025-11-04',
  bookerTimezone: 'America/New_York',
  now: new Date('2025-10-01T00:00:00Z'),
});
check('a full day survives the autumn change too', dayOf(fallBack, '2025-11-03').slots.length === 16);
check('the fall-back day is flagged', dayOf(fallBack, '2025-11-02')?.dstShift?.direction === 'back');

console.log('\nengine: zones that disagree about DST');
// In early November the US has changed but the UK already did in late October,
// so the London-New York gap is briefly 4 hours instead of the usual 5.
const gapCheck = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'America/New_York')],
  bookings: [],
  fromKey: '2025-10-28',
  toKey: '2025-10-28',
  bookerTimezone: 'Europe/London',
  now: new Date('2025-10-01T00:00:00Z'),
});
check(
  'a London booker sees a New York morning correctly',
  gapCheck.days[0].slots.length > 0 &&
    tz.utcToZoned(gapCheck.days[0].slots[0].startAt, 'America/New_York').hour === 9
);

console.log('\nengine: half-hour offset zones');
const india = computeAvailability({
  eventType: eventType(),
  hosts: [host('h1', 'Asia/Kolkata')],
  bookings: [],
  fromKey: '2025-06-02',
  toKey: '2025-06-02',
  bookerTimezone: 'Asia/Kolkata',
  now: NOW,
});
check('an IST host gets a normal day', dayOf(india, '2025-06-02').slots.length === 16);
check(
  'the first IST slot is 03:30Z',
  dayOf(india, '2025-06-02').slots[0].startAt === '2025-06-02T03:30:00.000Z'
);

/* ---------- the booking-time re-check ---------- */

console.log('\nengine: verifySlot guards the write');
const okSlot = verifySlot({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  startAt: '2025-06-02T10:00:00Z',
  now: NOW,
});
check('a genuinely free slot verifies', okSlot.ok === true);
check('it returns the host to assign', okSlot.hostIds[0] === 'h1');

const takenSlot = verifySlot({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [booking('2025-06-02T10:00:00Z', 30, ['h1'])],
  startAt: '2025-06-02T10:00:00Z',
  now: NOW,
});
check('a slot taken in the meantime is rejected', takenSlot.ok === false);

const outsideHours = verifySlot({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  startAt: '2025-06-02T22:00:00Z',
  now: NOW,
});
check('a slot outside working hours is rejected', outsideHours.ok === false);

const onWeekend = verifySlot({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  startAt: '2025-06-07T10:00:00Z',
  now: NOW,
});
check('a weekend slot is rejected', onWeekend.ok === false);

const tooSoon = verifySlot({
  eventType: eventType({ minimumNoticeMinutes: 120 }),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  startAt: '2025-06-02T10:00:00Z',
  now: new Date('2025-06-02T09:30:00Z'),
});
check('a slot inside the notice window is rejected', tooSoon.ok === false);

const tooFar = verifySlot({
  eventType: eventType({ maximumAdvanceDays: 7 }),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  startAt: '2025-08-04T10:00:00Z',
  now: NOW,
});
check('a slot past the horizon is rejected', tooFar.ok === false);

const collectiveVerify = verifySlot({
  eventType: eventType({ assignment: 'collective' }),
  hosts: [host('h1', 'UTC'), host('h2', 'UTC')],
  bookings: [booking('2025-06-02T10:00:00Z', 30, ['h2'])],
  startAt: '2025-06-02T10:00:00Z',
  now: NOW,
});
check('collective is rejected when one host got busy', collectiveVerify.ok === false);

const garbage = verifySlot({
  eventType: eventType(),
  hosts: [host('h1', 'UTC')],
  bookings: [],
  startAt: 'not-a-date',
  now: NOW,
});
check('garbage input is rejected rather than throwing', garbage.ok === false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
