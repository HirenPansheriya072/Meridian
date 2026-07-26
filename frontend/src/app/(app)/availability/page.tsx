'use client';

import { useEffect, useState } from 'react';
import { CalendarOff, Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSaveSchedule, useSchedule, useSession, useUpdateProfile } from '@/lib/queries';
import type { Override, Window } from '@/lib/types';
import { addDaysToKey, dateKeyIn, zoneCity } from '@/lib/tz';
import { clockToMinutes, cn, minutesToClock, WEEKDAY_NAMES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, TimeSelect, DateSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { TimezonePicker } from '@/components/timezone-picker';

/**
 * The working-hours editor.
 *
 * Everything here is in the HOST's own wall clock. The banner says so explicitly,
 * because the single biggest source of scheduling confusion is someone entering
 * hours while thinking about a different zone than the one they are stored in.
 */
export default function AvailabilityPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useSchedule();
  const save = useSaveSchedule();
  const updateProfile = useUpdateProfile();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success) {
      toast.success(success);
      router.replace('/availability');
    } else if (error) {
      toast.error(error);
      router.replace('/availability');
    }
  }, [searchParams, router]);

  const [weekly, setWeekly] = useState<Window[][]>([[], [], [], [], [], [], []]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.schedule) {
      setWeekly(data.schedule.weekly);
      setOverrides(data.schedule.overrides || []);
      setDirty(false);
    }
  }, [data]);

  const timezone = session?.user.timezone || 'UTC';

  function setWindow(dayIndex: number, windowIndex: number, patch: Partial<Window>) {
    setWeekly((prev) =>
      prev.map((day, d) =>
        d === dayIndex ? day.map((w, i) => (i === windowIndex ? { ...w, ...patch } : w)) : day
      )
    );
    setDirty(true);
  }

  function addWindow(dayIndex: number) {
    setWeekly((prev) =>
      prev.map((day, d) => {
        if (d !== dayIndex) return day;
        // A second window starts an hour after the last one ends, so a lunch break
        // is two clicks rather than four fiddly edits.
        const last = day[day.length - 1];
        const start = last ? Math.min(last.end + 60, 22 * 60) : 9 * 60;
        return [...day, { start, end: Math.min(start + 480, 24 * 60) }];
      })
    );
    setDirty(true);
  }

  function removeWindow(dayIndex: number, windowIndex: number) {
    setWeekly((prev) => prev.map((day, d) => (d === dayIndex ? day.filter((_, i) => i !== windowIndex) : day)));
    setDirty(true);
  }

  /** Copying Monday to the rest of the week is the single most-wanted action here. */
  function copyToWeekdays(dayIndex: number) {
    setWeekly((prev) => prev.map((day, d) => (d >= 1 && d <= 5 ? prev[dayIndex].map((w) => ({ ...w })) : day)));
    setDirty(true);
    toast.success('Copied to Monday–Friday');
  }

  const invalid = weekly.some((day) => day.some((w) => w.end <= w.start));

  if (isLoading) {
    return (
      <div className="p-5 lg:p-7">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="hair bg-surface px-5 py-4 lg:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="spec">Availability</p>
            <h1 className="mt-1 font-display text-2xl leading-none">Working hours</h1>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={save.isPending}
            disabled={!dirty || invalid}
            onClick={() => save.mutate({ weekly, overrides }, { onSuccess: () => setDirty(false) })}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="max-w-3xl space-y-5 p-5 lg:p-7">
        {/* The zone banner. Non-negotiable: these numbers mean nothing without it. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dusk/20 bg-dusk-soft px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-dusk">
              These hours are in {zoneCity(timezone)} time
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              9:00 stays 9:00 for you when the clocks change — the UTC instant moves instead.
            </p>
          </div>
          <TimezonePicker
            value={timezone}
            onChange={(tz) => updateProfile.mutate({ timezone: tz })}
          />
        </div>

        <section className="card divide-y divide-rule">
          {WEEKDAY_NAMES.map((name, dayIndex) => {
            const windows = weekly[dayIndex] || [];
            const closed = windows.length === 0;

            return (
              <div key={name} className="flex flex-wrap items-start gap-3 p-4">
                <div className="w-24 shrink-0 pt-1.5">
                  <p className={cn('text-[13px] font-medium', closed && 'text-ink-faint')}>{name}</p>
                  {closed ? <p className="text-[11px] text-ink-faint">Closed</p> : null}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {windows.map((window, windowIndex) => {
                    const bad = window.end <= window.start;
                    return (
                      <div key={windowIndex} className="flex flex-wrap items-center gap-2">
                        <TimeSelect
                          value={minutesToClock(window.start)}
                          onChange={(val) => setWindow(dayIndex, windowIndex, { start: clockToMinutes(val) })}
                          className={cn(bad && '[&>button]:border-bad')}
                        />
                        <span className="text-[12px] text-ink-faint">to</span>
                        <TimeSelect
                          value={minutesToClock(window.end)}
                          onChange={(val) => setWindow(dayIndex, windowIndex, { end: clockToMinutes(val) })}
                          className={cn(bad && '[&>button]:border-bad')}
                        />
                        <button
                          onClick={() => removeWindow(dayIndex, windowIndex)}
                          className="rounded p-1.5 text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                          aria-label="Remove window"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {bad ? <span className="text-[11px] text-bad">End must be after start</span> : null}
                      </div>
                    );
                  })}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => addWindow(dayIndex)}
                    className="rounded p-1.5 text-ink-faint transition-colors hover:bg-rule hover:text-ink"
                    aria-label={`Add hours on ${name}`}
                    title="Add a window"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {windows.length > 0 ? (
                    <button
                      onClick={() => copyToWeekdays(dayIndex)}
                      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-rule hover:text-ink"
                      aria-label="Copy to weekdays"
                      title="Copy to Monday–Friday"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base">Specific dates</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Holidays and one-off changes. These beat the weekly pattern.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const base = dateKeyIn(new Date(), timezone);
                setOverrides((prev) => [
                  ...prev,
                  { date: addDaysToKey(base, 7), label: '', windows: [] },
                ]);
                setDirty(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add a date
            </Button>
          </div>

          {overrides.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-faint">
              Nothing set. Add a date to close it off or give it different hours.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {overrides.map((override, i) => {
                const closed = override.windows.length === 0;
                return (
                  <li key={i} className="rounded border border-rule bg-chalk/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <DateSelect
                        value={override.date}
                        onChange={(val) => {
                          setOverrides((prev) => prev.map((o, idx) => (idx === i ? { ...o, date: val } : o)));
                          setDirty(true);
                        }}
                      />
                      <Input
                        value={override.label || ''}
                        onChange={(e) => {
                          setOverrides((prev) => prev.map((o, idx) => (idx === i ? { ...o, label: e.target.value } : o)));
                          setDirty(true);
                        }}
                        placeholder="Reason (optional)"
                        className="h-9 max-w-[200px] flex-1 text-[13px]"
                      />

                      {closed ? (
                        <span className="flex items-center gap-1.5 rounded bg-rule px-2 py-1 text-[11px] text-ink-muted">
                          <CalendarOff className="h-3 w-3" />
                          Closed all day
                        </span>
                      ) : (
                        override.windows.map((w, wi) => (
                          <span key={wi} className="flex items-center gap-1.5">
                            <TimeSelect
                              value={minutesToClock(w.start)}
                              onChange={(val) => {
                                setOverrides((prev) =>
                                  prev.map((o, idx) =>
                                    idx === i
                                      ? {
                                          ...o,
                                          windows: o.windows.map((x, xi) =>
                                            xi === wi ? { ...x, start: clockToMinutes(val) } : x
                                          ),
                                        }
                                      : o
                                  )
                                );
                                setDirty(true);
                              }}
                            />
                            <span className="text-[12px] text-ink-faint">to</span>
                            <TimeSelect
                              value={minutesToClock(w.end)}
                              onChange={(val) => {
                                setOverrides((prev) =>
                                  prev.map((o, idx) =>
                                    idx === i
                                      ? {
                                          ...o,
                                          windows: o.windows.map((x, xi) =>
                                            xi === wi ? { ...x, end: clockToMinutes(val) } : x
                                          ),
                                        }
                                      : o
                                  )
                                );
                                setDirty(true);
                              }}
                            />
                          </span>
                        ))
                      )}

                      <div className="ml-auto flex gap-1">
                        <button
                          onClick={() => {
                            setOverrides((prev) =>
                              prev.map((o, idx) =>
                                idx === i
                                  ? { ...o, windows: closed ? [{ start: 9 * 60, end: 17 * 60 }] : [] }
                                  : o
                              )
                            );
                            setDirty(true);
                          }}
                          className="rounded px-2 py-1 text-[11px] text-ink-muted transition-colors hover:bg-rule"
                        >
                          {closed ? 'Set hours' : 'Close the day'}
                        </button>
                        <button
                          onClick={() => {
                            setOverrides((prev) => prev.filter((_, idx) => idx !== i));
                            setDirty(true);
                          }}
                          className="rounded p-1.5 text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Calendar Connections */}
        <section className="card p-5">
          <div>
            <h2 className="font-display text-base">Calendar Connections</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Connect external calendars to automatically block slots when you are busy.
            </p>
          </div>

          <div className="mt-6 space-y-4 divide-y divide-rule">
            {/* Google Calendar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 first:pt-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-[14px]">
                  G
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-ink leading-tight">Google Calendar</h3>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    {session?.user.googleCalendar?.connected
                      ? `Connected as ${session.user.googleCalendar.email}`
                      : 'Not connected'}
                  </p>
                </div>
              </div>
              <div>
                {session?.user.googleCalendar?.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-bad hover:bg-bad/5"
                    onClick={async () => {
                      try {
                        await api.post('/auth/google/disconnect');
                        qc.invalidateQueries({ queryKey: ['session'] });
                        toast.success('Google Calendar disconnected');
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = `${api.baseUrl}/auth/google`;
                    }}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Outlook Calendar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[14px]">
                  O
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-ink leading-tight">Outlook Calendar</h3>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    {session?.user.outlookCalendar?.connected
                      ? `Connected as ${session.user.outlookCalendar.email}`
                      : 'Not connected'}
                  </p>
                </div>
              </div>
              <div>
                {session?.user.outlookCalendar?.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-bad hover:bg-bad/5"
                    onClick={async () => {
                      try {
                        await api.post('/auth/outlook/disconnect');
                        qc.invalidateQueries({ queryKey: ['session'] });
                        toast.success('Outlook Calendar disconnected');
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = `${api.baseUrl}/auth/outlook`;
                    }}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
