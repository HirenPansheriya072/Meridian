'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, Users, Video } from 'lucide-react';
import { useAvailability, useCreateBooking, usePublicPage } from '@/lib/queries';
import {
  addDaysToKey,
  dateIn,
  dateKeyIn,
  describeGap,
  guessTimezone,
  offsetAt,
  time24In,
  timeIn,
  zoneCity,
} from '@/lib/tz';
import { cn, durationLabel, LOCATION_LABEL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, CustomSelect } from '@/components/ui/input';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';
import { TimezonePicker } from '@/components/timezone-picker';
import { TimezoneRibbon } from '@/components/timezone-ribbon';
import { SlotCalendar } from '@/components/slot-calendar';
import { api } from '@/lib/api';

export default function BookingPage() {
  const { orgSlug, eventSlug } = useParams<{ orgSlug: string; eventSlug: string }>();

  // The browser's own guess is right ~99% of the time; the picker is for the rest.
  const [timezone, setTimezone] = useState('UTC');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimezone(guessTimezone());
    setMounted(true);
  }, []);

  const todayKey = mounted ? dateKeyIn(new Date(), timezone) : '1970-01-01';
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ manageToken: string; startAt: string } | null>(null);

  useEffect(() => {
    if (mounted && !monthKey) setMonthKey(todayKey.slice(0, 8) + '01');
  }, [mounted, monthKey, todayKey]);

  const { data: page, isLoading: pageLoading, isError } = usePublicPage(orgSlug, eventSlug);

  const range = useMemo(() => {
    if (!monthKey) return null;
    const { 0: y, 1: m } = monthKey.split('-');
    const daysInMonth = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
    const from = `${y}-${m}-01`;
    return { from, to: `${y}-${m}-${String(daysInMonth).padStart(2, '0')}` };
  }, [monthKey]);

  const { data: availability, isFetching } = useAvailability(
    orgSlug,
    eventSlug,
    range?.from || '',
    range?.to || '',
    timezone
  );

  const book = useCreateBooking(orgSlug, eventSlug);
  const [form, setForm] = useState({ name: '', email: '', notes: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hostTimezone = availability?.hostTimezone || page?.hosts[0]?.timezone || 'UTC';
  const daySlots = availability?.days.find((d) => d.date === selectedDate)?.slots || [];
  const selectedDay = availability?.days.find((d) => d.date === selectedDate);

  if (pageLoading || !mounted) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-96 w-full" />
      </main>
    );
  }

  if (isError || !page) {
    return (
      <main className="mx-auto max-w-lg px-5 py-24">
        <EmptyState
          title="This booking page does not exist"
          body="The link may be out of date, or the event was switched off."
        />
      </main>
    );
  }

  /* ---------- confirmation ---------- */

  if (confirmed) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <div className="card p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-sea text-white">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl">You&rsquo;re booked</h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            A confirmation is on its way to {form.email}, with a calendar invite attached.
          </p>

          <div className="mt-6 rounded-lg border border-rule bg-chalk/60 p-4 text-left">
            <p className="spec">{page.eventType.title}</p>
            <p className="mt-1.5 font-display text-lg">{dateIn(confirmed.startAt, timezone)}</p>
            <p className="tnum font-mono text-[13px] text-ink-muted">
              {timeIn(confirmed.startAt, timezone)} · {zoneCity(timezone)}
            </p>

            <div className="mt-4 border-t border-rule pt-4">
              <TimezoneRibbon
                instant={confirmed.startAt}
                bookerTimezone={timezone}
                hostTimezone={hostTimezone}
                hostName={page.hosts[0]?.name}
              />
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" asChild>
              <a href={`${api.baseUrl}/booking/${confirmed.manageToken}/ics`}>
                <Calendar className="h-4 w-4" />
                Add to calendar
              </a>
            </Button>
            <Button variant="primary" asChild>
              <Link href={`/booking/${confirmed.manageToken}`}>Manage booking</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- the form step ---------- */

  function submit() {
    const problems: Record<string, string> = {};
    if (!form.name.trim()) problems.name = 'We need a name';
    if (!form.email.includes('@')) problems.email = 'Enter a valid email';
    for (const q of page!.eventType.questions) {
      if (q.required && !answers[q.key]?.trim()) problems[q.key] = 'This one is required';
    }
    if (Object.keys(problems).length) return setErrors(problems);
    setErrors({});

    book.mutate(
      {
        startAt: selectedSlot!,
        timezone,
        name: form.name.trim(),
        email: form.email.trim(),
        notes: form.notes || undefined,
        answers,
      },
      {
        onSuccess: (data) => {
          const url = page?.eventType?.redirectUrl;
          if (url) {
            window.location.href = url;
          } else {
            setConfirmed({ manageToken: data.booking.manageToken, startAt: data.booking.startAt });
          }
        },
      }
    );
  }

  const LocationIcon = page.eventType.location.type === 'video' ? Video : MapPin;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="card overflow-hidden">
        <div className="grid lg:grid-cols-[280px_1fr]">
          {/* Left rail: what you are booking and with whom. */}
          <aside className="border-b border-rule p-6 lg:border-b-0 lg:border-r">
            <p className="spec">{page.org.name}</p>
            <h1 className="mt-2 font-display text-[26px] leading-tight">{page.eventType.title}</h1>

            <div className="mt-4 space-y-2 text-[13px] text-ink-muted">
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-ink-faint" />
                {durationLabel(page.eventType.durationMinutes)}
              </p>
              <p className="flex items-center gap-2">
                <LocationIcon className="h-3.5 w-3.5 text-ink-faint" />
                {page.eventType.location.detail || LOCATION_LABEL[page.eventType.location.type]}
              </p>
              {page.eventType.assignment === 'collective' ? (
                <p className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-ink-faint" />
                  All {page.hosts.length} hosts attend
                </p>
              ) : null}
            </div>

            {page.eventType.description ? (
              <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
                {page.eventType.description}
              </p>
            ) : null}

            <div className="mt-5 border-t border-rule pt-4">
              <p className="spec mb-2.5">
                {page.eventType.assignment === 'roundRobin' ? 'One of' : 'With'}
              </p>
              <ul className="space-y-2.5">
                {page.hosts.map((host) => (
                  <li key={host.id} className="flex items-center gap-2.5">
                    <Avatar name={host.name} color={host.avatarColor} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{host.name}</span>
                      <span className="block truncate font-mono text-[10px] text-ink-faint">
                        {zoneCity(host.timezone)} · {describeGap(host.timezone, timezone)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section className="p-6">
            {!selectedSlot ? (
              <div className="grid gap-8 lg:grid-cols-[1fr_210px]">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="spec">Pick a day</p>
                    <TimezonePicker value={timezone} onChange={setTimezone} />
                  </div>
                  <SlotCalendar
                    days={availability?.days || []}
                    monthKey={monthKey!}
                    selectedDate={selectedDate}
                    onSelect={setSelectedDate}
                    onMonthChange={(delta) => {
                      const { 0: y, 1: m } = monthKey!.split('-').map(Number) as unknown as number[];
                      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
                      setMonthKey(d.toISOString().slice(0, 8) + '01');
                      setSelectedDate(null);
                    }}
                    loading={isFetching && !availability}
                    canGoBack={monthKey! > todayKey.slice(0, 8) + '01'}
                  />
                </div>

                <div className="lg:border-l lg:border-rule lg:pl-6">
                  {!selectedDate ? (
                    <p className="text-[13px] text-ink-faint">
                      Choose a date and the free times will appear here, in your own clock.
                    </p>
                  ) : (
                    <>
                      <p className="spec">{dateIn(`${selectedDate}T12:00:00Z`, 'UTC')}</p>

                      {/* DST notice, in whichever zone is affected. This is the thing
                          that saves a meeting twice a year. */}
                      {selectedDay?.dstShift ? (
                        <p className="mt-2 rounded border border-dawn/30 bg-dawn-soft px-2.5 py-2 text-[11px] leading-snug text-dawn-dark">
                          Your clocks go {selectedDay.dstShift.direction} an hour on this day.
                        </p>
                      ) : selectedDay?.hostDstShift ? (
                        <p className="mt-2 rounded border border-dawn/30 bg-dawn-soft px-2.5 py-2 text-[11px] leading-snug text-dawn-dark">
                          The host&rsquo;s clocks change this day, so their local time shifts by an hour.
                        </p>
                      ) : null}

                      {daySlots.length === 0 ? (
                        <p className="mt-3 text-[13px] text-ink-faint">Nothing free that day.</p>
                      ) : (
                        <ul className="mt-3 max-h-[380px] space-y-1.5 overflow-y-auto scroll-thin pr-1">
                          {daySlots.map((slot) => (
                            <li key={slot.startAt}>
                              <button
                                onClick={() => setSelectedSlot(slot.startAt)}
                                className="group flex w-full items-baseline justify-between gap-2 rounded border border-rule-strong bg-surface px-3 py-2 transition-colors hover:border-dusk hover:bg-dusk hover:text-white"
                              >
                                <span className="tnum font-mono text-[13px]">
                                  {timeIn(slot.startAt, timezone)}
                                </span>
                                {/* The host's clock, always visible. Never make someone
                                    do the arithmetic themselves. */}
                                <span className="tnum font-mono text-[10px] text-ink-faint group-hover:text-white/60">
                                  {time24In(slot.startAt, hostTimezone)} there
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-md">
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="mb-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Pick another time
                </button>

                <div className="rounded-lg border border-rule bg-chalk/60 p-4">
                  <p className="font-display text-lg">{dateIn(selectedSlot, timezone)}</p>
                  <p className="tnum font-mono text-[13px] text-ink-muted">
                    {timeIn(selectedSlot, timezone)} · {durationLabel(page.eventType.durationMinutes)}
                  </p>
                  <div className="mt-3.5 border-t border-rule pt-3.5">
                    <TimezoneRibbon
                      instant={selectedSlot}
                      bookerTimezone={timezone}
                      hostTimezone={hostTimezone}
                      hostName={page.hosts[0]?.name}
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-3.5">
                  <Field label="Your name" error={errors.name}>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      autoFocus
                    />
                  </Field>
                  <Field label="Email" error={errors.email} hint="Where the invite goes.">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </Field>

                  {page.eventType.questions.map((q) => (
                    <Field key={q.key} label={q.label + (q.required ? '' : ' (optional)')} error={errors[q.key]}>
                      {q.type === 'textarea' ? (
                        <Textarea
                          rows={3}
                          value={answers[q.key] || ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                        />
                      ) : q.type === 'select' ? (
                        <CustomSelect
                          value={answers[q.key] || ''}
                          onChange={(val) => setAnswers((a) => ({ ...a, [q.key]: val }))}
                          options={q.options}
                        />
                      ) : (
                        <Input
                          type={q.type === 'phone' ? 'tel' : 'text'}
                          value={answers[q.key] || ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                        />
                      )}
                    </Field>
                  ))}

                  <Field label="Anything else? (optional)">
                    <Textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </Field>

                  <Button variant="primary" size="lg" className="w-full" loading={book.isPending} onClick={submit}>
                    Confirm booking
                  </Button>
                  <p className="text-center text-[11px] text-ink-faint">
                    You can reschedule or cancel from the link in your email.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <p className="mt-4 text-center font-mono text-[10px] text-ink-faint">
        Times shown in {zoneCity(timezone)} · host is in {zoneCity(hostTimezone)}
      </p>
    </main>
  );
}
