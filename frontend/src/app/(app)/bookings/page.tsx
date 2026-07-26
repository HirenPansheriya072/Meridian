'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { useBookings, useCancelBooking, useSession } from '@/lib/queries';
import type { Booking } from '@/lib/types';
import { dateIn, time24In, timeIn, zoneCity } from '@/lib/tz';
import { BOOKING_STATUS, cn, durationLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { TimezoneRibbon } from '@/components/timezone-ribbon';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

export default function BookingsPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('upcoming');
  const [open, setOpen] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useBookings(tab);
  const cancel = useCancelBooking();
  const viewerZone = session?.user.timezone || 'UTC';

  return (
    <div>
      <div className="hair bg-surface px-5 py-4 lg:px-7">
        <p className="spec">Bookings</p>
        <h1 className="mt-1 font-display text-2xl leading-none">Everything on the books</h1>

        <div className="mt-4 flex gap-1" style={{ marginBottom: '-1rem' }}>
          {TABS.map((t) => {
            const count = data?.counts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors',
                  tab === t.id ? 'border-dusk text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                )}
              >
                {t.label}
                {count ? (
                  <span className="tnum rounded-sm bg-rule px-1 font-mono text-[10px] text-ink-muted">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 lg:p-7">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={tab === 'upcoming' ? 'Nothing coming up' : `No ${tab} bookings`}
            body={
              tab === 'upcoming'
                ? 'Share an event type link and bookings will appear here.'
                : 'Nothing to show in this tab yet.'
            }
          />
        ) : (
          <ul className="card divide-y divide-rule overflow-hidden">
            {data.items.map((booking) => {
              const hosts = (booking.hostIds || []) as { _id: string; name: string; avatarColor: string; timezone: string }[];
              const status = BOOKING_STATUS[booking.status];
              const differs = booking.bookerTimezone !== viewerZone;

              return (
                <li key={booking._id}>
                  <button
                    onClick={() => setOpen(booking)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-chalk/60"
                  >
                    <div className="w-[76px] shrink-0">
                      <p className="tnum font-mono text-[13px]">{time24In(booking.startAt, viewerZone)}</p>
                      <p className="font-mono text-[10px] text-ink-faint">
                        {new Date(booking.startAt).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          timeZone: viewerZone,
                        })}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{booking.eventTitle}</p>
                      <p className="truncate text-[12px] text-ink-muted">
                        {booking.attendee.name} · {booking.attendee.email}
                      </p>
                      {differs ? (
                        <p className="truncate font-mono text-[10px] text-dawn-dark">
                          {time24In(booking.startAt, booking.bookerTimezone)} their time ·{' '}
                          {zoneCity(booking.bookerTimezone)}
                        </p>
                      ) : null}
                    </div>

                    <Badge className={cn(status.className, 'shrink-0')}>{status.label}</Badge>

                    <div className="flex shrink-0 -space-x-1.5">
                      {hosts.map((h) => (
                        <Avatar key={h._id} name={h.name} color={h.avatarColor} size="xs" className="ring-2 ring-surface" />
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          {open ? (
            <>
              <DialogHeader title={open.eventTitle} description={`${open.attendee.name} · ${open.attendee.email}`} />
              <DialogBody>
                <div className="rounded-lg border border-rule bg-chalk/60 p-4">
                  <p className="font-display text-lg">{dateIn(open.startAt, viewerZone)}</p>
                  <p className="tnum font-mono text-[13px] text-ink-muted">
                    {timeIn(open.startAt, viewerZone)} · {durationLabel(open.durationMinutes)}
                  </p>
                  <div className="mt-3.5 border-t border-rule pt-3.5">
                    {/* Host's view: "you" is the host here, "them" is the attendee. */}
                    <TimezoneRibbon
                      instant={open.startAt}
                      bookerTimezone={viewerZone}
                      hostTimezone={open.bookerTimezone}
                      hostName={open.attendee.name}
                    />
                  </div>
                </div>

                {open.attendee.notes ? (
                  <div>
                    <p className="spec">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                      {open.attendee.notes}
                    </p>
                  </div>
                ) : null}

                {open.answers && Object.keys(open.answers).length > 0 ? (
                  <div>
                    <p className="spec">Answers</p>
                    <dl className="mt-1.5 space-y-1">
                      {Object.entries(open.answers).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-[13px]">
                          <dt className="capitalize text-ink-faint">{key}:</dt>
                          <dd className="text-ink-muted">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                {open.cancelReason ? (
                  <p className="rounded border border-rule bg-chalk px-3 py-2 text-[12px] text-ink-muted">
                    Cancelled: {open.cancelReason}
                  </p>
                ) : null}
              </DialogBody>

              {open.status === 'confirmed' || open.status === 'pending' ? (
                <DialogFooter>
                  <Button
                    variant="ghost"
                    className="text-bad"
                    onClick={() => {
                      setCancelling(open);
                      setOpen(null);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel booking
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelling)} onOpenChange={(v) => !v && setCancelling(null)}>
        <DialogContent>
          <DialogHeader
            title="Cancel this booking?"
            description={`${cancelling?.attendee.name} will get an email letting them know.`}
          />
          <DialogBody>
            <Field label="Reason (optional)" hint="Included in the email.">
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button
              variant="bad"
              loading={cancel.isPending}
              onClick={() =>
                cancelling &&
                cancel.mutate(
                  { id: cancelling._id, reason: reason || undefined },
                  {
                    onSuccess: () => {
                      setCancelling(null);
                      setReason('');
                    },
                  }
                )
              }
            >
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
