/**
 * Timezone conversion tests.
 *
 * Every assertion here is a real transition in the IANA database, not a synthetic
 * case. If these pass, the scheduling engine is standing on solid ground.
 */
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

console.log('\ntz: offsets are sampled at an instant, never assumed');
check('New York is -300 in January', tz.offsetAt(new Date('2025-01-15T12:00:00Z'), 'America/New_York') === -300);
check('New York is -240 in July', tz.offsetAt(new Date('2025-07-15T12:00:00Z'), 'America/New_York') === -240);
check('London is 0 in January', tz.offsetAt(new Date('2025-01-15T12:00:00Z'), 'Europe/London') === 0);
check('London is +60 in July', tz.offsetAt(new Date('2025-07-15T12:00:00Z'), 'Europe/London') === 60);
check('Sydney is +660 in January (southern summer)', tz.offsetAt(new Date('2025-01-15T12:00:00Z'), 'Australia/Sydney') === 660);
check('Sydney is +600 in July', tz.offsetAt(new Date('2025-07-15T12:00:00Z'), 'Australia/Sydney') === 600);

console.log('\ntz: half and quarter hour zones');
check('Kolkata is +330 all year', tz.offsetAt(new Date('2025-01-15T12:00:00Z'), 'Asia/Kolkata') === 330);
check('Kathmandu is +345', tz.offsetAt(new Date('2025-06-15T12:00:00Z'), 'Asia/Kathmandu') === 345);
// Chatham is +12:45 standard and +13:45 in southern summer -- a 45-minute zone that also does DST.
check('Chatham is +825 in January (DST)', tz.offsetAt(new Date('2025-01-15T12:00:00Z'), 'Pacific/Chatham') === 825);
check('Chatham is +765 in July (standard)', tz.offsetAt(new Date('2025-07-15T12:00:00Z'), 'Pacific/Chatham') === 765);
check('Adelaide is +570 in July', tz.offsetAt(new Date('2025-07-15T12:00:00Z'), 'Australia/Adelaide') === 570);

console.log('\ntz: wall time to UTC');
check(
  '9am New York in winter is 14:00Z',
  tz.zonedToUtc({ year: 2025, month: 1, day: 15, hour: 9, minute: 0 }, 'America/New_York').toISOString() ===
    '2025-01-15T14:00:00.000Z'
);
check(
  '9am New York in summer is 13:00Z',
  tz.zonedToUtc({ year: 2025, month: 7, day: 15, hour: 9, minute: 0 }, 'America/New_York').toISOString() ===
    '2025-07-15T13:00:00.000Z'
);
check(
  '2:30pm Kolkata is 09:00Z',
  tz.zonedToUtc({ year: 2025, month: 6, day: 1, hour: 14, minute: 30 }, 'Asia/Kolkata').toISOString() ===
    '2025-06-01T09:00:00.000Z'
);

console.log('\ntz: the same wall time is a different instant across a DST boundary');
const beforeSpring = tz.zonedToUtc({ year: 2025, month: 3, day: 8, hour: 9, minute: 0 }, 'America/New_York');
const afterSpring = tz.zonedToUtc({ year: 2025, month: 3, day: 10, hour: 9, minute: 0 }, 'America/New_York');
check('9am on Mar 8 is 14:00Z', beforeSpring.toISOString() === '2025-03-08T14:00:00.000Z');
check('9am on Mar 10 is 13:00Z', afterSpring.toISOString() === '2025-03-10T13:00:00.000Z');
check(
  'two days apart is 47 hours, not 48',
  (afterSpring.getTime() - beforeSpring.getTime()) / 3600000 === 47
);

const beforeFall = tz.zonedToUtc({ year: 2025, month: 11, day: 1, hour: 9, minute: 0 }, 'America/New_York');
const afterFall = tz.zonedToUtc({ year: 2025, month: 11, day: 3, hour: 9, minute: 0 }, 'America/New_York');
check(
  'across fall-back, two days apart is 49 hours',
  (afterFall.getTime() - beforeFall.getTime()) / 3600000 === 49
);

console.log('\ntz: round trips survive');
const roundTrips = [
  ['America/New_York', { year: 2025, month: 1, day: 15, hour: 9, minute: 0 }],
  ['Asia/Kolkata', { year: 2025, month: 6, day: 1, hour: 14, minute: 30 }],
  ['Europe/London', { year: 2025, month: 7, day: 4, hour: 23, minute: 45 }],
  ['Pacific/Auckland', { year: 2025, month: 12, day: 25, hour: 6, minute: 15 }],
  ['America/Sao_Paulo', { year: 2025, month: 2, day: 20, hour: 17, minute: 5 }],
];
for (const [zone, parts] of roundTrips) {
  const back = tz.utcToZoned(tz.zonedToUtc(parts, zone), zone);
  check(
    `${zone} ${parts.hour}:${String(parts.minute).padStart(2, '0')} survives a round trip`,
    back.year === parts.year && back.month === parts.month && back.day === parts.day &&
      back.hour === parts.hour && back.minute === parts.minute
  );
}

console.log('\ntz: DST detection');
check('US spring forward is found', tz.dstShiftOnDay('2025-03-09', 'America/New_York')?.direction === 'forward');
check('US spring forward is 60 minutes', tz.dstShiftOnDay('2025-03-09', 'America/New_York')?.minutes === 60);
check('US fall back is found', tz.dstShiftOnDay('2025-11-02', 'America/New_York')?.direction === 'back');
check('EU spring forward is found', tz.dstShiftOnDay('2025-03-30', 'Europe/London')?.direction === 'forward');
check('an ordinary day has no shift', tz.dstShiftOnDay('2025-06-10', 'America/New_York') === null);
check('India never shifts', tz.dstShiftOnDay('2025-03-09', 'Asia/Kolkata') === null);

console.log('\ntz: date keys walk without drifting');
check('adding a day is plain', tz.addDaysToKey('2025-03-08', 1) === '2025-03-09');
check('crossing a spring-forward day does not drift', tz.addDaysToKey('2025-03-09', 1) === '2025-03-10');
check('month rollover works', tz.addDaysToKey('2025-01-31', 1) === '2025-02-01');
check('leap day exists in 2024', tz.addDaysToKey('2024-02-28', 1) === '2024-02-29');
check('2025 has no leap day', tz.addDaysToKey('2025-02-28', 1) === '2025-03-01');
check('year rollover works', tz.addDaysToKey('2025-12-31', 1) === '2026-01-01');
check('going backwards works', tz.addDaysToKey('2025-01-01', -1) === '2024-12-31');

console.log('\ntz: the booker and the host are on different days');
// 9am Monday in New York is 10pm Monday in Tokyo; 9pm Monday NY is Tuesday in Tokyo.
const nyEvening = tz.zonedToUtc({ year: 2025, month: 6, day: 2, hour: 21, minute: 0 }, 'America/New_York');
check('NY Monday evening is Tokyo Tuesday', tz.dateKeyInZone(nyEvening, 'Asia/Tokyo') === '2025-06-03');
check('NY Monday evening is still Monday in NY', tz.dateKeyInZone(nyEvening, 'America/New_York') === '2025-06-02');

console.log('\ntz: clock parsing');
check("'09:30' is 570 minutes", tz.parseClock('09:30') === 570);
check("'00:00' is 0", tz.parseClock('00:00') === 0);
check("'24:00' is 1440", tz.parseClock('24:00') === 1440);
check('570 formats back to 09:30', tz.formatClock(570) === '09:30');
check('bad input throws', (() => { try { tz.parseClock('9am'); return false; } catch { return true; } })());

console.log('\ntz: zone validation');
check('a real zone validates', tz.isValidTimeZone('Europe/Berlin'));
check('a fake zone does not', !tz.isValidTimeZone('Mars/Olympus_Mons'));
check('offset formats for display', tz.formatOffset(330) === '+05:30' && tz.formatOffset(-300) === '-05:00');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
