'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useEventType } from '@/lib/queries';
import { EventTypeForm } from '@/components/event-type-form';
import { Skeleton } from '@/components/ui/misc';

export default function EditEventTypePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useEventType(id);

  return (
    <div className="p-5 lg:p-7">
      <Link
        href="/event-types"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" />
        Event types
      </Link>

      {isLoading ? (
        <>
          <Skeleton className="mb-6 mt-3 h-8 w-56" />
          <Skeleton className="h-96 w-full max-w-4xl" />
        </>
      ) : isError || !data ? (
        <p className="mt-6 text-sm text-ink-muted">That event type does not exist.</p>
      ) : (
        <>
          <h1 className="mb-6 mt-3 font-display text-2xl">{data.eventType.title}</h1>
          <EventTypeForm eventType={data.eventType} id={id} />
        </>
      )}
    </div>
  );
}
