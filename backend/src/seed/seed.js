/* eslint-disable no-console */
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDb } = require('../config/db');
const Org = require('../models/Org');
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const EventType = require('../models/EventType');
const Booking = require('../models/Booking');
const tz = require('../utils/tz');

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * A distributed studio, on purpose.
 *
 * Three hosts on three continents is the only way to demonstrate what this app is
 * actually for. A single-timezone seed makes every hard part of the engine invisible.
 */
const TEAM = [
  { name: 'Ines Whitlock', email: env.demo.email, role: 'owner', timezone: 'Europe/London', title: 'Principal', color: 'dusk' },
  { name: 'Kwame Boateng', email: 'kwame@meridian.scheduling', role: 'member', timezone: 'America/New_York', title: 'Strategy lead', color: 'dawn' },
  { name: 'Sana Iqbal', email: 'sana@meridian.scheduling', role: 'member', timezone: 'Asia/Kolkata', title: 'Delivery lead', color: 'sea' },
];

const ATTENDEES = [
  ['Priya Raval', 'priya@meridianfoods.com', 'Asia/Kolkata'],
  ['Daniel Okafor', 'd.okafor@brightpath.io', 'Europe/London'],
  ['Hannah Lindqvist', 'hannah@nordlys.se', 'Europe/Stockholm'],
  ['Marcus Webb', 'marcus@calderon.law', 'America/New_York'],
  ['Aisha Mahmoud', 'aisha@sunroute.travel', 'Asia/Dubai'],
  ['Tom Behrens', 'tom@behrensbuild.com', 'America/Chicago'],
  ['Sofia Marchetti', 'sofia@atelier.it', 'Europe/Rome'],
  ['Grace Adeyemi', 'grace@lumenclinic.co.uk', 'Europe/London'],
  ['Yusuf Karim', 'yusuf@karimlogistics.ae', 'Asia/Dubai'],
  ['Elena Vasquez', 'elena@verdeorganics.mx', 'America/Mexico_City'],
  ['Nina Petrova', 'nina@stackforge.dev', 'Europe/Berlin'],
  ['Jack Donnelly', 'jack@harborcoffee.com', 'America/Los_Angeles'],
  ['Mei Tanaka', 'mei@kotoworks.jp', 'Asia/Tokyo'],
  ['Owen Fletcher', 'owen@fletchergym.com', 'Australia/Sydney'],
];

const NOTES = [
  'Happy to share the deck beforehand if useful.',
  'Mostly want to talk about timelines and budget.',
  'Referred by Priya at Meridian Foods.',
  'We have an internal deadline at the end of the month.',
  '',
  '',
  'Second conversation — following up on the scoping call.',
];

async function seed() {
  await connectDb();
  console.log('Clearing existing data...');
  await Promise.all([
    Org.deleteMany({}),
    User.deleteMany({}),
    Schedule.deleteMany({}),
    EventType.deleteMany({}),
    Booking.deleteMany({}),
  ]);

  const org = await Org.create({
    name: 'Longitude Studio',
    slug: 'longitude',
    timezone: 'Europe/London',
  });

  const passwordHash = await User.hashPassword(env.demo.password);
  const users = await User.create(
    TEAM.map((t) => ({
      orgId: org._id,
      name: t.name,
      email: t.email,
      passwordHash,
      role: t.role,
      timezone: t.timezone,
      title: t.title,
      avatarColor: t.color,
    }))
  );
  const [ines, kwame, sana] = users;

  console.log('Setting working hours...');
  const nineToFive = Schedule.nineToFive();
  // A late start on Mondays, and Fridays that finish early -- the kind of thing a
  // real person's calendar actually looks like.
  const inesWeek = [
    [],
    [{ start: 10 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 13 * 60 }],
    [],
  ];
  // A split day: morning, lunch, afternoon.
  const kwameWeek = [
    [],
    [{ start: 9 * 60, end: 12 * 60 }, { start: 13 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 12 * 60 }, { start: 13 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 12 * 60 }, { start: 13 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 12 * 60 }, { start: 13 * 60, end: 17 * 60 }],
    [{ start: 9 * 60, end: 12 * 60 }],
    [],
  ];

  const today = tz.dateKeyInZone(new Date(), 'Europe/London');

  await Schedule.create([
    {
      orgId: org._id,
      userId: ines._id,
      name: 'Working hours',
      isDefault: true,
      weekly: inesWeek,
      overrides: [
        { date: tz.addDaysToKey(today, 9), label: 'Conference — away', windows: [] },
        { date: tz.addDaysToKey(today, 16), label: 'Half day', windows: [{ start: 9 * 60, end: 12 * 60 }] },
      ],
    },
    { orgId: org._id, userId: kwame._id, name: 'Working hours', isDefault: true, weekly: kwameWeek, overrides: [] },
    { orgId: org._id, userId: sana._id, name: 'Working hours', isDefault: true, weekly: nineToFive, overrides: [] },
  ]);

  console.log('Creating event types...');
  const eventTypes = await EventType.create([
    {
      orgId: org._id,
      title: 'Intro call',
      slug: 'intro-call',
      description: 'A quick conversation to work out whether we are a fit. No prep needed.',
      color: 'dusk',
      durationMinutes: 30,
      slotIncrementMinutes: 30,
      bufferAfterMinutes: 10,
      minimumNoticeMinutes: 4 * 60,
      maximumAdvanceDays: 45,
      assignment: 'single',
      hostIds: [ines._id],
      location: { type: 'video', detail: 'Link sent on confirmation' },
      questions: [
        { key: 'company', label: 'Company', type: 'text', required: true },
        { key: 'topic', label: 'What would you like to cover?', type: 'textarea', required: false },
      ],
    },
    {
      orgId: org._id,
      title: 'Project kickoff',
      slug: 'project-kickoff',
      description: 'Ninety minutes with the whole team to scope the work properly.',
      color: 'dawn',
      durationMinutes: 90,
      slotIncrementMinutes: 30,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
      minimumNoticeMinutes: 24 * 60,
      maximumAdvanceDays: 60,
      maxBookingsPerDay: 2,
      // Everyone must be free -- this is the case that shows off interval intersection.
      assignment: 'collective',
      hostIds: [ines._id, kwame._id, sana._id],
      location: { type: 'video', detail: '' },
      questions: [
        { key: 'company', label: 'Company', type: 'text', required: true },
        { key: 'stage', label: 'Where are you up to?', type: 'select', options: ['Just an idea', 'Have a brief', 'Mid-project', 'Rescue job'], required: true },
      ],
    },
    {
      orgId: org._id,
      title: 'Office hours',
      slug: 'office-hours',
      description: 'Fifteen minutes with whoever is free. Bring one specific question.',
      color: 'sea',
      durationMinutes: 15,
      slotIncrementMinutes: 15,
      minimumNoticeMinutes: 60,
      maximumAdvanceDays: 21,
      // Anyone free will do, load balanced -- the union case.
      assignment: 'roundRobin',
      hostIds: [ines._id, kwame._id, sana._id],
      location: { type: 'phone', detail: 'We will call you' },
      questions: [{ key: 'question', label: 'Your question', type: 'textarea', required: true }],
    },
    {
      orgId: org._id,
      title: 'Design review',
      slug: 'design-review',
      description: 'Walk through work in progress together.',
      color: 'dusk',
      durationMinutes: 45,
      slotIncrementMinutes: 15,
      bufferAfterMinutes: 15,
      assignment: 'single',
      hostIds: [sana._id],
      location: { type: 'video', detail: '' },
      questions: [],
      active: false,
    },
  ]);

  console.log('Filling the diary...');
  const bookings = [];
  const now = Date.now();

  /** Land on a plausible working hour in the host's own zone. */
  function slotFor(hostTimezone, dayOffset, hourLocal, minuteLocal = 0) {
    const key = tz.addDaysToKey(tz.dateKeyInZone(new Date(), hostTimezone), dayOffset);
    const { year, month, day } = tz.parseDateKey(key);
    return tz.zonedToUtc({ year, month, day, hour: hourLocal, minute: minuteLocal }, hostTimezone);
  }

  function pushBooking({ eventType, hosts, dayOffset, hour, minute = 0, status = 'confirmed' }) {
    const [name, email, attendeeZone] = rand(ATTENDEES);
    const startAt = slotFor(hosts[0].timezone, dayOffset, hour, minute);
    const endAt = new Date(startAt.getTime() + eventType.durationMinutes * 60000);

    bookings.push({
      orgId: org._id,
      eventTypeId: eventType._id,
      eventTitle: eventType.title,
      hostIds: hosts.map((h) => h._id),
      startAt,
      endAt,
      durationMinutes: eventType.durationMinutes,
      hostTimezone: hosts[0].timezone,
      bookerTimezone: attendeeZone,
      attendee: { name, email, notes: rand(NOTES) },
      answers: { company: email.split('@')[1].split('.')[0] },
      status,
      location: eventType.location,
      createdAt: new Date(now - Math.floor(Math.random() * 12) * 86400000),
    });
  }

  const [intro, kickoff, officeHours] = eventTypes;

  // Past, so the dashboard's history tab is not empty.
  for (let i = 1; i <= 8; i += 1) {
    pushBooking({ eventType: intro, hosts: [ines], dayOffset: -i * 2, hour: 11 + (i % 4) });
  }
  for (let i = 1; i <= 3; i += 1) {
    pushBooking({ eventType: officeHours, hosts: [rand([ines, kwame, sana])], dayOffset: -i * 3, hour: 14 });
  }

  // Upcoming, spread across hosts and times so the board looks lived-in.
  const upcoming = [
    { eventType: intro, hosts: [ines], dayOffset: 1, hour: 11 },
    { eventType: intro, hosts: [ines], dayOffset: 1, hour: 15 },
    { eventType: officeHours, hosts: [kwame], dayOffset: 2, hour: 10, minute: 15 },
    { eventType: kickoff, hosts: [ines, kwame, sana], dayOffset: 3, hour: 14 },
    { eventType: intro, hosts: [ines], dayOffset: 4, hour: 10 },
    { eventType: officeHours, hosts: [sana], dayOffset: 4, hour: 16 },
    { eventType: intro, hosts: [ines], dayOffset: 7, hour: 12 },
    { eventType: officeHours, hosts: [kwame], dayOffset: 8, hour: 11, minute: 30 },
    { eventType: kickoff, hosts: [ines, kwame, sana], dayOffset: 10, hour: 14 },
  ];
  upcoming.forEach((u) => pushBooking(u));

  // A couple of cancellations, so the cancel rate is not a suspicious zero.
  pushBooking({ eventType: intro, hosts: [ines], dayOffset: 5, hour: 13, status: 'cancelled' });
  pushBooking({ eventType: officeHours, hosts: [sana], dayOffset: 6, hour: 15, status: 'cancelled' });

  const created = await Booking.insertMany(bookings);
  // insertMany overwrites createdAt, so pin the backdated ones again.
  await Promise.all(
    created.map((b, i) =>
      Booking.updateOne({ _id: b._id }, { $set: { createdAt: bookings[i].createdAt } }, { timestamps: false })
    )
  );

  const nowDate = new Date();
  console.log('\nSeeded Longitude Studio');
  console.log(`  ${users.length} hosts across ${new Set(TEAM.map((t) => t.timezone)).size} timezones`);
  console.log(`  ${eventTypes.length} event types, ${created.length} bookings`);
  console.log('\n  Host timezones right now:');
  for (const user of users) {
    const z = tz.utcToZoned(nowDate, user.timezone);
    console.log(
      `    ${user.name.padEnd(16)} ${user.timezone.padEnd(20)} ${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')} (${tz.formatOffset(tz.offsetAt(nowDate, user.timezone))})`
    );
  }
  console.log(`\n  Login:        ${env.demo.email} / ${env.demo.password}`);
  console.log(`  Booking page: /longitude/intro-call`);
  console.log(`  Collective:   /longitude/project-kickoff  (all three must be free)`);
  console.log(`  Round robin:  /longitude/office-hours`);

  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
