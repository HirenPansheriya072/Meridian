'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, Clock, MapPin, Video, XCircle } from 'lucide-react';
import {
  useAvailability,
  useCancelByToken,
  useManagedBooking,
  useRescheduleByToken,
} from '@/lib/queries';
import { addDaysToKey, dateIn, dateKeyIn, guessTimezone, time24In, timeIn, zoneCity } from '@/lib/tz';
import { cn, durationLabel, LOCATION_LABEL } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { TimezoneRibbon } from '@/components/timezone-ribbon';
import { SlotCalendar } from '@/components/slot-calendar';

/**
 * Manage a booking with no account, using the unguessable token from the email.
 * Requiring a signup to cancel is how you end up with no-shows instead of cancellations.
 */
export default function ManageBookingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useManagedBooking(token);

  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [moving, setMoving] = useState(false);

  const cancel = useCancelByToken(token);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-lg px-5 py-24">
        <EmptyState
          title="That link is not valid"
          body="It may have expired, or the booking was already removed. Check the most recent email."
        />
      </main>
    );
  }

  const { booking, hosts, org, eventSlug } = data;
  const bookerZone = booking.bookerTimezone;
  const hostZone = booking.hostTimezone;
  const past = new Date(booking.startAt) < new Date();
  const dead = booking.status === 'cancelled' || booking.status === 'rescheduled';

  if (moving && eventSlug) {
    return (
      <RescheduleView
        token={token}
        orgSlug={org.slug}
        eventSlug={eventSlug}
        booking={booking}
        onBack={() => setMoving(false)}
        onDone={(newToken) => router.push(`/booking/${newToken}`)}
      />
    );
  }

  const LocationIcon = booking.location?.type === 'video' ? Video : MapPin;

  return (
    <main className="mx-auto max-w-lg px-5 py-14">
      <div className="card overflow-hidden">
        <div className={cn('p-6', dead && 'opacity-70')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="spec">{org.name}</p>
              <h1 className="mt-1.5 font-display text-2xl leading-tight">{booking.eventTitle}</h1>
            </div>
            {booking.status === 'cancelled' ? (
              <Badge className="bg-rule text-ink-faint">Cancelled</Badge>
            ) : booking.status === 'rescheduled' ? (
              <Badge className="bg-rule text-ink-faint">Moved</Badge>
            ) : past ? (
              <Badge className="bg-rule text-ink-faint">Done</Badge>
            ) : (
              <Badge className="bg-sea-soft text-sea">
                <CheckCircle2 className="h-3 w-3" />
                Confirmed
              </Badge>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-rule bg-chalk/60 p-4">
            <p className={cn('font-display text-lg', dead && 'line-through')}>
              {dateIn(booking.startAt, bookerZone)}
            </p>
            <p className="tnum font-mono text-[13px] text-ink-muted">
              {timeIn(booking.startAt, bookerZone)} · {durationLabel(booking.durationMinutes)}
            </p>

            <div className="mt-3.5 border-t border-rule pt-3.5">
              <TimezoneRibbon
                instant={booking.startAt}
                bookerTimezone={bookerZone}
                hostTimezone={hostZone}
                hostName={hosts[0]?.name}
              />
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-[13px]">
            <div className="flex items-center gap-2 text-ink-muted">
              <Clock className="h-3.5 w-3.5 text-ink-faint" />
              {durationLabel(booking.durationMinutes)}
            </div>
            {booking.location ? (
              <div className="flex items-center gap-2 text-ink-muted">
                <LocationIcon className="h-3.5 w-3.5 text-ink-faint" />
                {booking.location.detail || LOCATION_LABEL[booking.location.type] || booking.location.type}
              </div>
            ) : null}
          </dl>

          <div className="mt-4 border-t border-rule pt-4">
            <p className="spec mb-2.5">With</p>
            <ul className="space-y-2">
              {hosts.map((h) => (
                <li key={h.name} className="flex items-center gap-2.5">
                  <Avatar name={h.name} color={h.avatarColor} size="sm" />
                  <span>
                    <span className="block text-[13px]">{h.name}</span>
                    <span className="block font-mono text-[10px] text-ink-faint">
                      {zoneCity(h.timezone)} · {time24In(booking.startAt, h.timezone)} their time
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {booking.cancelReason ? (
            <p className="mt-4 rounded border border-rule bg-chalk px-3 py-2 text-[12px] text-ink-muted">
              Reason given: {booking.cancelReason}
            </p>
          ) : null}
        </div>

        {!dead && !past ? (
          <div className="flex flex-wrap gap-2 border-t border-rule bg-chalk/40 p-4">
            <Button variant="secondary" size="sm" asChild>
              <a href={`${api.baseUrl}/booking/${token}/ics`}>
                <Calendar className="h-3.5 w-3.5" />
                Add to calendar
              </a>
            </Button>
            {eventSlug ? (
              <Button variant="secondary" size="sm" onClick={() => setMoving(true)}>
                Reschedule
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-bad"
              onClick={() => setCancelling(true)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent>
          <DialogHeader title="Cancel this booking?" description="Everyone gets an email letting them know." />
          <DialogBody>
            <Field label="Reason (optional)" hint="Helpful, but not required.">
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelling(false)}>
              Keep it
            </Button>
            <Button
              variant="bad"
              loading={cancel.isPending}
              onClick={() => cancel.mutate(reason || undefined, { onSuccess: () => setCancelling(false) })}
            >
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function RescheduleView({
  token,
  orgSlug,
  eventSlug,
  booking,
  onBack,
  onDone,
}: {
  token: string;
  orgSlug: string;
  eventSlug: string;
  booking: { startAt: string; bookerTimezone: string; hostTimezone: string; eventTitle: string };
  onBack: () => void;
  onDone: (newToken: string) => void;
}) {
  const [timezone, setTimezone] = useState(booking.bookerTimezone);
  const [monthKey, setMonthKey] = useState(dateKeyIn(new Date(), booking.bookerTimezone).slice(0, 8) + '01');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const reschedule = useRescheduleByToken(token);
  const todayKey = dateKeyIn(new Date(), timezone);

  useEffect(() => setTimezone(booking.bookerTimezone), [booking.bookerTimezone]);

  const range = useMemo(() => {
    const [y, m] = monthKey.split('-');
    const daysInMonth = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(daysInMonth).padStart(2, '0')}` };
  }, [monthKey]);

  const { data: availability, isFetching } = useAvailability(
    orgSlug,
    eventSlug,
    range.from,
    range.to,
    timezone
  );

  const daySlots = availability?.days.find((d) => d.date === selectedDate)?.slots || [];
  const hostZone = availability?.hostTimezone || booking.hostTimezone;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <button
        onClick={onBack}
        className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
      >
        ← Back to the booking
      </button>

      <div className="card p-6">
        <p className="spec">Moving</p>
        <h1 className="mt-1.5 font-display text-2xl">{booking.eventTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Currently {dateIn(booking.startAt, timezone)} at {timeIn(booking.startAt, timezone)}.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_200px]">
          <SlotCalendar
            days={availability?.days || []}
            monthKey={monthKey}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            onMonthChange={(delta) => {
              const [y, m] = monthKey.split('-').map(Number);
              const d = new Date(Date.UTC(y, m - 1 + delta, 1));
              setMonthKey(d.toISOString().slice(0, 8) + '01');
              setSelectedDate(null);
            }}
            loading={isFetching && !availability}
            canGoBack={monthKey > todayKey.slice(0, 8) + '01'}
          />

          <div className="lg:border-l lg:border-rule lg:pl-6">
            {!selectedDate ? (
              <p className="text-[13px] text-ink-faint">Pick a new day.</p>
            ) : daySlots.length === 0 ? (
              <p className="text-[13px] text-ink-faint">Nothing free that day.</p>
            ) : (
              <ul className="max-h-[360px] space-y-1.5 overflow-y-auto scroll-thin pr-1">
                {daySlots.map((slot) => (
                  <li key={slot.startAt}>
                    <button
                      disabled={reschedule.isPending}
                      onClick={() =>
                        reschedule.mutate(
                          { startAt: slot.startAt, timezone },
                          { onSuccess: (data) => onDone(data.booking.manageToken) }
                        )
                      }
                      className="group flex w-full items-baseline justify-between gap-2 rounded border border-rule-strong bg-surface px-3 py-2 transition-colors hover:border-dusk hover:bg-dusk hover:text-white disabled:opacity-50"
                    >
                      <span className="tnum font-mono text-[13px]">{timeIn(slot.startAt, timezone)}</span>
                      <span className="tnum font-mono text-[10px] text-ink-faint group-hover:text-white/60">
                        {time24In(slot.startAt, hostZone)} there
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
