'use client';

import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Globe2 } from 'lucide-react';
import { useSummary } from '@/lib/queries';
import { describeGap, shortDateIn, time24In, timeIn, zoneCity } from '@/lib/tz';
import { cn, durationLabel } from '@/lib/utils';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';

export default function DashboardPage() {
  const { data, isLoading } = useSummary();

  if (isLoading || !data) {
    return (
      <div className="p-5 lg:p-7">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const { cards, next, days, byEvent, byZone, viewerTimezone } = data;

  return (
    <div>
      <div className="hair bg-surface px-5 py-4 lg:px-7">
        <p className="spec">Overview</p>
        <h1 className="mt-1 font-display text-2xl leading-none">Your calendar</h1>
      </div>

      <div className="space-y-5 p-5 lg:p-7">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Next 7 days" value={String(cards.thisWeek)} sub="bookings coming up" accent />
          <Stat label="All time" value={String(cards.total)} sub="bookings taken" />
          <Stat label="Hours booked" value={`${cards.hoursBooked}`} sub="across every event type" />
          <Stat
            label="Cancel rate"
            value={cards.cancelRate === null ? '—' : `${cards.cancelRate}%`}
            sub={`${cards.cancelled} cancelled`}
            warn={cards.cancelRate !== null && cards.cancelRate > 20}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="card overflow-hidden">
            <div className="hair flex items-center justify-between px-4 py-3">
              <p className="spec">What&rsquo;s next</p>
              <Link href="/bookings" className="text-[12px] font-medium text-dusk hover:underline">
                All bookings
              </Link>
            </div>

            {next.length === 0 ? (
              <EmptyState
                className="border-0 py-10"
                title="Nothing booked yet"
                body="Share an event type link and bookings will land here."
              />
            ) : (
              <ul>
                {next.map((booking) => {
                  const hosts = (booking.hostIds || []) as { _id: string; name: string; avatarColor: string; timezone: string }[];
                  const hostZone = hosts[0]?.timezone || viewerTimezone;
                  const differs = booking.bookerTimezone !== viewerTimezone;

                  return (
                    <li key={booking._id} className="flex items-start gap-3 border-b border-rule px-4 py-3 last:border-0">
                      <div className="w-[68px] shrink-0">
                        <p className="tnum font-mono text-[13px]">{time24In(booking.startAt, viewerTimezone)}</p>
                        <p className="font-mono text-[10px] text-ink-faint">
                          {shortDateIn(booking.startAt, viewerTimezone)}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{booking.eventTitle}</p>
                        <p className="truncate text-[12px] text-ink-muted">
                          {booking.attendee.name}
                          {/* Their local time, always. This is the number that stops
                              you scheduling someone's midnight. */}
                          {differs ? (
                            <span className="text-ink-faint">
                              {' '}· {time24In(booking.startAt, booking.bookerTimezone)} in{' '}
                              {zoneCity(booking.bookerTimezone)}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 -space-x-1.5">
                        {hosts.map((h) => (
                          <Avatar key={h._id} name={h.name} color={h.avatarColor} size="xs" className="ring-2 ring-surface" />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Where bookings come from. Genuinely actionable: if half your demand is
              in Asia and your day ends at 5pm London, you can see that here. */}
          <section className="card overflow-hidden">
            <div className="hair flex items-center gap-1.5 px-4 py-3">
              <Globe2 className="h-3.5 w-3.5 text-ink-faint" />
              <p className="spec">Where people book from</p>
            </div>

            {byZone.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-ink-faint">No bookings yet.</p>
            ) : (
              <ul className="p-4">
                {byZone.map((zone) => {
                  const max = byZone[0].count || 1;
                  return (
                    <li key={zone.timezone} className="mb-3 last:mb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px]">{zoneCity(zone.timezone)}</span>
                        <span className="tnum shrink-0 font-mono text-[11px] text-ink-muted">
                          {zone.count}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
                          <span
                            className="block h-full rounded-full bg-dawn"
                            style={{ width: `${(zone.count / max) * 100}%` }}
                          />
                        </span>
                        <span className="tnum w-12 shrink-0 text-right font-mono text-[10px] text-ink-faint">
                          {zone.offset}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                        {describeGap(zone.timezone, viewerTimezone)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="card p-5">
            <p className="spec">Bookings taken, last 14 days</p>
            <div className="mt-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="bookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2B3A67" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#2B3A67" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E0DFD9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8A909E' }} axisLine={{ stroke: '#E0DFD9' }} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A909E', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: '1px solid #E0DFD9', fontSize: 12, fontFamily: 'var(--font-body)' }}
                    formatter={(v: number) => [`${v} booking${v === 1 ? '' : 's'}`, '']}
                  />
                  <Area type="monotone" dataKey="n" stroke="#2B3A67" strokeWidth={1.5} fill="url(#bookings)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="hair px-4 py-3">
              <p className="spec">By event type</p>
            </div>
            {byEvent.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-ink-faint">Nothing booked yet.</p>
            ) : (
              <ul className="p-4">
                {byEvent.map((e) => {
                  const max = byEvent[0].count || 1;
                  return (
                    <li key={e.title} className="mb-3 last:mb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px]">{e.title}</span>
                        <span className="tnum shrink-0 font-mono text-[11px] text-ink-muted">{e.count}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
                          <span className="block h-full rounded-full bg-dusk" style={{ width: `${(e.count / max) * 100}%` }} />
                        </span>
                        <span className="tnum w-10 shrink-0 text-right font-mono text-[10px] text-ink-faint">
                          {e.hours}h
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="spec">{label}</p>
      <p
        className={cn(
          'tnum mt-2 font-mono text-[24px] font-medium leading-none',
          accent && 'text-dusk',
          warn && 'text-bad'
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-ink-faint">{sub}</p>
    </div>
  );
}
