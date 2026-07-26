# Meridian

A booking and scheduling system built around the part every other one gets quietly wrong:
**timezones and daylight saving.**

Hosts write their working hours once, in their own wall clock. Bookers see every time in *their*
clock and the host's, side by side. When the clocks change, 9am stays 9am — and the days they change
are marked on the calendar before anyone picks a slot.

Separate **Next.js** frontend and **Express + MongoDB** API.

---

## What's in it

| Area | What it does |
|---|---|
| **Availability engine** | Weekly hours + date overrides → bookable slots, computed across three clocks |
| **Public booking page** | Month calendar bucketed in the *booker's* zone, live timezone switching, dual-clock slot list |
| **Group scheduling** | `single`, `collective` (everyone must be free — set intersection), `roundRobin` (anyone free, load-balanced) |
| **Buffers & limits** | Padding before/after, minimum notice, booking horizon, max bookings per day |
| **Reschedule & cancel** | Attendees manage their own booking via an unguessable token — no account needed |
| **Calendar files** | Hand-rolled RFC 5545 `.ics`, correctly folded and escaped, attached to every confirmation |
| **Dashboard** | Upcoming bookings, booking volume, **where in the world people book from** |
| **Emails** | Confirmations and cancellations showing *both* parties' local times |

---

## Stack

**Frontend** — Next.js 14 (App Router), TypeScript, Tailwind, TanStack Query, Recharts, Radix
**Backend** — Node, Express, MongoDB + Mongoose, Zod, JWT, Nodemailer

No date library. `Intl` carries the IANA database in Node and every browser, and the conversion
logic *is* the product — so it's written by hand and tested hard rather than delegated.

---

## Run it locally

```bash
cd backend
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm install
npm run seed              # Longitude Studio: 3 hosts in 3 timezones
npm run dev
```

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

**Demo login:** `demo@meridian.scheduling` / `demo1234`

Booking pages worth opening (try switching the timezone picker while you're there):

| Link | Shows off |
|---|---|
| `/longitude/intro-call` | The straightforward case — one host in London |
| `/longitude/project-kickoff` | **Collective**: all three hosts, so slots are the intersection of London + New York + Kolkata. The window is genuinely narrow |
| `/longitude/office-hours` | **Round robin**: the union of all three, load-balanced on booking |

---

## The hard parts

### Three clocks, never two

```
Host's rules   →  wall time, host's zone     "I work 9 to 5"
Storage        →  UTC instants                the only unambiguous frame
Booker's view  →  wall time, booker's zone    where the day boundaries actually fall
```

A Tokyo visitor's Tuesday morning is a New York host's Monday evening. Availability is therefore
computed in UTC and *bucketed into days in the booker's zone* — which is why the engine scans a day
wider at each end than the range requested.

### Wall time survives DST; instants don't

Working hours are stored as **minutes from local midnight**, never as instants:

```js
weekly[1] = [{ start: 540, end: 1020 }]   // Monday, 09:00–17:00 — always
```

Store `9am` as a UTC instant and every host in the northern hemisphere silently starts work an hour
early each spring. The tests assert the fix directly: on either side of 9 March 2025, a New York
host still starts at 9am local — but the UTC instant moves from `14:00Z` to `13:00Z`.

Dates are also walked **by date key, never by adding 86,400,000 ms**, because a spring-forward day
is 23 hours long and fixed-millisecond stepping drifts an hour and corrupts every day after it.

### Availability is set algebra

`utils/intervals.js` is 90 lines of merge / subtract / intersect over half-open `[start, end)`
intervals. Everything else falls out of it:

- **free** = working hours − (bookings + buffers)
- **collective** = intersect every host's free time
- **round robin** = merge every host's free time

Intervals that merely touch don't overlap, so a 9:00–9:30 and a 9:30–10:00 call are back to back
rather than a conflict.

### The slot grid anchors to working hours, not free gaps

Subtle, and the tests caught it during the build. Generate slots from the *free* intervals left
after removing a booking, and one 12:00 meeting drags the whole afternoon off the clock — the
customer is offered 12:45, 13:15, 13:45. All technically available. Still looks broken.

So candidate times come from the **working window**, then get filtered by free time. There's a
regression test named for it.

### Never trust the slot the client posts

The list a browser is looking at was computed seconds ago and someone else may have taken that time
since. `verifySlot()` recomputes availability at the moment of booking, and a partial unique index
on `(orgId, startAt, hostIds)` — scoped to live bookings only, so cancelled slots free up — catches
the genuine race underneath.

---

## Tests

```bash
cd backend && npm test
# tz:           46 passed
# availability: 72 passed
```

118 assertions, no test framework — just `node`. They cover:

- Real IANA transitions (US, EU, and southern-hemisphere DST)
- Half- and quarter-hour zones — Kolkata `+05:30`, Kathmandu `+05:45`, Chatham `+12:45`/`+13:45`
- Zones that disagree about DST for a fortnight each autumn
- Interval algebra: merge, subtract, intersect, touching-not-overlapping
- Buffers, notice windows, booking horizons, daily caps, holiday overrides
- Collective vs round-robin host selection
- `verifySlot` rejecting taken, out-of-hours, weekend, too-soon, and malformed slots

---

## API

```
POST   /auth/register | /auth/login | /auth/demo | /auth/logout
GET    /auth/me          PATCH /auth/profile          GET /team

GET    /public/:org/:event                    Booking page metadata
GET    /public/:org/:event/availability       ?from=&to=&timezone=
POST   /public/:org/:event/book               Re-verifies the slot before writing

GET    /booking/:token                        Manage without an account
GET    /booking/:token/ics                    RFC 5545 download
POST   /booking/:token/cancel | /reschedule

GET    /event-types      POST · GET/:id · PATCH/:id · DELETE/:id
GET    /schedule         PUT /schedule
GET    /bookings         POST /bookings/:id/cancel
GET    /summary
```

---

## Design

The palette is named for the **terminator line** — the edge between day and night sweeping across
the globe, which is what this app is actually about. Deep dusk navy for chrome, warm dawn amber for
*your* time, sea green for *theirs*. Two zones are never the same colour.

The signature component is the **dual-timezone ribbon**: one instant shown on two 24-hour bands at
once, working hours shaded, the slot marked on both. The commonest failure in remote scheduling is
booking a perfectly reasonable 9am without registering it's 11pm for the other person. A number
can't show you that. A picture of both days can, at a glance, before you click.

---

## Known gaps

- **No Google/Outlook sync.** Bookings are stored here; external busy-time isn't read. That's the
  obvious next integration and it's a real project on its own.
- **No team invites.** Seeded or self-registered hosts only.
- **Reminders aren't scheduled.** Confirmations and cancellations send; a cron sweep for "starts in
  an hour" is sketched by the `remindersSent` field but not wired.
- **One schedule per host.** The model supports named schedules; the UI only edits the default.
- **Recurring events** and **payments** are deliberately out of scope.
- **Fall-back ambiguity** resolves to the first (pre-transition) instant, matching every major
  calendar app — but it is a genuine ambiguity in the calendar, not something code can fix.
