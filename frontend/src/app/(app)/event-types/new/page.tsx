'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { EventTypeForm } from '@/components/event-type-form';

export default function NewEventTypePage() {
  return (
    <div className="p-5 lg:p-7">
      <Link
        href="/event-types"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" />
        Event types
      </Link>
      <h1 className="mb-6 mt-3 font-display text-2xl">New event type</h1>
      <EventTypeForm id="new" />
    </div>
  );
}
