'use client';

import { describeGap, offsetAt, formatOffset, time24In, zoneCity } from '@/lib/tz';
import { cn } from '@/lib/utils';

/**
 * THE SIGNATURE COMPONENT.
 *
 * Every scheduling tool shows you a time. This shows you the SAME INSTANT in two
 * places at once -- yours in dawn amber, the host's in sea green -- as a 24-hour
 * ribbon with the slot marked on both.
 *
 * The reason is simple: the single commonest failure in remote scheduling is
 * someone booking what looks like a reasonable 9am, not registering that it is
 * 11pm for the other person, and both parties only discovering it the night before.
 * A number cannot show you that. A picture of the two days side by side can, at a
 * glance, before you click.
 *
 * Working hours are shaded, so "this is the edge of their day" is visible rather
 * than something you have to work out.
 */
export function TimezoneRibbon({
  instant,
  bookerTimezone,
  hostTimezone,
  hostName,
  className,
}: {
  instant: string | Date;
  bookerTimezone: string;
  hostTimezone: string;
  hostName?: string;
  className?: string;
}) {
  const date = new Date(instant);
  const identical = offsetAt(date, bookerTimezone) === offsetAt(date, hostTimezone);

  // Position within a 24-hour band, per zone.
  const positionIn = (zone: string) => {
    const [h, m] = time24In(date, zone).split(':').map(Number);
    return ((h * 60 + m) / 1440) * 100;
  };

  const rows = [
    {
      key: 'you',
      label: 'You',
      zone: bookerTimezone,
      tone: 'dawn' as const,
    },
    {
      key: 'host',
      label: hostName || 'Host',
      zone: hostTimezone,
      tone: 'sea' as const,
    },
  ];

  if (identical) {
    return (
      <p className={cn('text-[12px] text-ink-muted', className)}>
        You and {hostName || 'the host'} are on the same clock right now.
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {rows.map((row) => {
        const pos = positionIn(row.zone);
        const isDawn = row.tone === 'dawn';
        return (
          <div key={row.key} className="flex items-center gap-2.5">
            <span
              className={cn(
                'w-10 shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]',
                isDawn ? 'text-dawn-dark' : 'text-sea'
              )}
            >
              {row.label.split(' ')[0]}
            </span>

            <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-dusk/5">
              {/* Night is the base; the working day 8am-6pm is lighter. That shading
                  is what makes "this is 11pm for them" legible without reading a number. */}
              <div
                className="absolute inset-y-0 bg-surface"
                style={{ left: `${(8 / 24) * 100}%`, width: `${(10 / 24) * 100}%` }}
              />
              {[6, 12, 18].map((h) => (
                <div
                  key={h}
                  className="absolute inset-y-0 w-px bg-rule"
                  style={{ left: `${(h / 24) * 100}%` }}
                />
              ))}

              <div
                className={cn(
                  'absolute inset-y-0 w-[3px] rounded-full',
                  isDawn ? 'bg-dawn' : 'bg-sea'
                )}
                style={{ left: `calc(${pos}% - 1.5px)` }}
              />
            </div>

            <span
              className={cn(
                'tnum w-11 shrink-0 text-right font-mono text-[11px]',
                isDawn ? 'text-dawn-dark' : 'text-sea'
              )}
            >
              {time24In(date, row.zone)}
            </span>
          </div>
        );
      })}

      <p className="pl-[3.1rem] font-mono text-[10px] text-ink-faint">
        {zoneCity(hostTimezone)} {formatOffset(offsetAt(date, hostTimezone))} ·{' '}
        {describeGap(hostTimezone, bookerTimezone, date)}
      </p>
    </div>
  );
}
