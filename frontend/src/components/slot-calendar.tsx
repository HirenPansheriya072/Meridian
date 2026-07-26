'use client';

import { ChevronLeft, ChevronRight, Sunrise, Sunset } from 'lucide-react';
import type { AvailabilityDay } from '@/lib/types';
import { addDaysToKey, monthLabel, parseDateKey, weekdayOfKey } from '@/lib/tz';
import { cn, WEEKDAY_MIN } from '@/lib/utils';
import { Skeleton } from '@/components/ui/misc';

/**
 * Month grid, bucketed in the BOOKER's timezone.
 *
 * A day here is the booker's day, not the host's -- which is why a Tokyo visitor
 * can see availability on a Tuesday that is, from New York's point of view,
 * entirely Monday evening. Getting that bucketing right on the server is what lets
 * this component stay simple.
 */
export function SlotCalendar({
  days,
  monthKey,
  selectedDate,
  onSelect,
  onMonthChange,
  loading,
  canGoBack,
}: {
  days: AvailabilityDay[];
  monthKey: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onMonthChange: (delta: number) => void;
  loading?: boolean;
  canGoBack: boolean;
}) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const { year, month } = parseDateKey(monthKey);

  const firstKey = `${year}-${String(month).padStart(2, '0')}-01`;
  const leadingBlanks = weekdayOfKey(firstKey);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDaysToKey(firstKey, i)),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg">{monthLabel(monthKey)}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onMonthChange(-1)}
            disabled={!canGoBack}
            className="rounded p-1.5 text-ink-muted transition-colors hover:bg-chalk disabled:opacity-30"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMonthChange(1)}
            className="rounded p-1.5 text-ink-muted transition-colors hover:bg-chalk"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {WEEKDAY_MIN.map((d, i) => (
          <span key={i} className="spec text-center">
            {d}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <span key={`blank-${i}`} />;

            const day = byDate.get(key);
            const count = day?.slots.length ?? 0;
            const open = count > 0;
            const selected = key === selectedDate;
            const shift = day?.dstShift;

            return (
              <button
                key={key}
                onClick={() => open && onSelect(key)}
                disabled={!open}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded text-[13px] transition-colors',
                  selected
                    ? 'bg-dusk text-white'
                    : open
                      ? 'bg-dusk-soft text-dusk hover:bg-dusk hover:text-white'
                      : 'text-ink-faint'
                )}
                title={
                  shift
                    ? `Clocks go ${shift.direction} on this day`
                    : open
                      ? `${count} time${count === 1 ? '' : 's'} free`
                      : 'Nothing free'
                }
              >
                <span className="tnum font-mono">{parseDateKey(key).day}</span>

                {/* A day the clocks change is marked, because a meeting either side
                    of it is exactly where people get an hour wrong. */}
                {shift ? (
                  shift.direction === 'forward' ? (
                    <Sunrise className={cn('absolute right-0.5 top-0.5 h-2.5 w-2.5', selected ? 'text-dawn-soft' : 'text-dawn')} />
                  ) : (
                    <Sunset className={cn('absolute right-0.5 top-0.5 h-2.5 w-2.5', selected ? 'text-dawn-soft' : 'text-dawn')} />
                  )
                ) : null}

                {open && !selected ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-dusk/50" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
        <Sunrise className="h-3 w-3 text-dawn" />
        marks a day the clocks change where you are
      </p>
    </div>
  );
}
