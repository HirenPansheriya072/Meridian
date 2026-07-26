'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, Globe, Search } from 'lucide-react';
import { allTimezones, formatOffset, offsetAt, time24In, zoneCity } from '@/lib/tz';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * Zone picker that shows the CURRENT LOCAL TIME in every option.
 *
 * "Europe/Berlin" means nothing to most people; "Berlin — 14:32" is instantly
 * recognisable as right or wrong. It turns picking a timezone from a memory test
 * into a glance.
 */
export function TimezonePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (zone: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const now = useMemo(() => new Date(), [open]);

  const zones = useMemo(() => {
    const all = allTimezones();
    if (!query.trim()) return all.slice(0, 60);
    const q = query.toLowerCase();
    return all.filter((z) => z.toLowerCase().includes(q)).slice(0, 60);
  }, [query]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded border border-rule-strong bg-surface px-2.5 py-1.5 text-[12px] transition-colors hover:border-ink-faint',
            className
          )}
        >
          <Globe className="h-3.5 w-3.5 text-ink-faint" />
          <span className="truncate">{zoneCity(value)}</span>
          <span className="tnum font-mono text-[11px] text-ink-faint">
            {formatOffset(offsetAt(now, value))}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[300px] animate-slide-up rounded-lg border border-rule bg-surface shadow-pop"
        >
          <div className="border-b border-rule p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cities or zones"
                className="h-8 pl-8 text-[13px]"
              />
            </div>
          </div>

          <ul className="max-h-[280px] overflow-y-auto scroll-thin p-1">
            {zones.map((zone) => (
              <li key={zone}>
                <button
                  onClick={() => {
                    onChange(zone);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-chalk',
                    zone === value && 'bg-dusk-soft'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{zoneCity(zone)}</span>
                    <span className="block truncate font-mono text-[10px] text-ink-faint">{zone}</span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-[11px] text-ink-muted">
                    {time24In(now, zone)}
                  </span>
                  {zone === value ? <Check className="h-3 w-3 shrink-0 text-dusk" /> : null}
                </button>
              </li>
            ))}
            {zones.length === 0 ? (
              <li className="px-2 py-6 text-center text-[12px] text-ink-faint">Nothing matches that</li>
            ) : null}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
