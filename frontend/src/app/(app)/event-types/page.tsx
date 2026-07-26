'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteEventType, useEventTypes, useSession, useTeam } from '@/lib/queries';
import type { EventType } from '@/lib/types';
import { ASSIGNMENT_LABEL, cn, durationLabel, LOCATION_LABEL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';

export default function EventTypesPage() {
  const { data: session } = useSession();
  const { data: team } = useTeam();
  const { data, isLoading } = useEventTypes();
  const remove = useDeleteEventType();
  const [confirming, setConfirming] = useState<EventType | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const orgSlug = session?.org?.slug;
  const hostById = new Map((team?.items || []).map((u) => [u.id, u]));

  function copyLink(slug: string) {
    const url = `${window.location.origin}/${orgSlug}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    toast.success('Link copied');
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div>
      <div className="hair bg-surface px-5 py-4 lg:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="spec">Event types</p>
            <h1 className="mt-1 font-display text-2xl leading-none">What people can book</h1>
          </div>
          <Button variant="primary" size="sm" asChild>
            <Link href="/event-types/new">
              <Plus className="h-3.5 w-3.5" />
              New event type
            </Link>
          </Button>
        </div>
      </div>

      <div className="p-5 lg:p-7">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Nothing bookable yet"
            body="An event type is the thing people book — a 30 minute call, a kickoff, office hours."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/event-types/new">Create the first one</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.items.map((event) => {
              const assignment = ASSIGNMENT_LABEL[event.assignment];
              return (
                <div key={event._id} className={cn('card flex flex-col p-5', !event.active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/event-types/${event._id}`} className="group">
                        <h2 className="font-display text-lg leading-tight group-hover:text-dusk">
                          {event.title}
                        </h2>
                      </Link>
                      <p className="mt-1 font-mono text-[11px] text-ink-faint">
                        /{orgSlug}/{event.slug}
                      </p>
                    </div>
                    {!event.active ? <Badge className="bg-rule text-ink-faint">Off</Badge> : null}
                  </div>

                  {event.description ? (
                    <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                      {event.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge className="bg-dusk-soft text-dusk">{durationLabel(event.durationMinutes)}</Badge>
                    <Badge className="bg-rule/60 text-ink-muted">
                      {LOCATION_LABEL[event.location.type]}
                    </Badge>
                    {event.assignment !== 'single' ? (
                      <Badge className="bg-dawn-soft text-dawn-dark">
                        <Users className="h-3 w-3" />
                        {assignment.label}
                      </Badge>
                    ) : null}
                    {event.bookingCount ? (
                      <Badge className="bg-sea-soft text-sea">{event.bookingCount} booked</Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 flex -space-x-1.5">
                    {event.hostIds.map((id) => {
                      const host = hostById.get(id);
                      return host ? (
                        <Avatar
                          key={id}
                          name={host.name}
                          color={host.avatarColor}
                          size="xs"
                          className="ring-2 ring-surface"
                        />
                      ) : null;
                    })}
                  </div>

                  <div className="mt-auto flex items-center gap-1.5 border-t border-rule pt-3.5">
                    <Button size="sm" variant="secondary" onClick={() => copyLink(event.slug)}>
                      {copied === event.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === event.slug ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/${orgSlug}/${event.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Preview
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild className="ml-auto">
                      <Link href={`/event-types/${event._id}`}>Edit</Link>
                    </Button>
                    <button
                      onClick={() => setConfirming(event)}
                      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(confirming)} onOpenChange={(v) => !v && setConfirming(null)}>
        <DialogContent>
          <DialogHeader title={`Delete "${confirming?.title}"?`} />
          <DialogBody>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              If anyone has this booked in the future it gets switched off instead of deleted, so
              nobody turns up to a meeting that quietly vanished.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant="bad"
              loading={remove.isPending}
              onClick={() => confirming && remove.mutate(confirming._id, { onSuccess: () => setConfirming(null) })}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
