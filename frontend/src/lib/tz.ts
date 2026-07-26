/**
 * Browser-side timezone helpers.
 *
 * Deliberately the same approach as the server's utils/tz.js -- Intl only, no
 * date library. The two must agree exactly, so they are written the same way.
 */

export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function offsetAt(instant: Date | string, timeZone: string): number {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const hour = parts.hour === 24 ? 0 : parts.hour;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** The clock time an instant shows in a zone, e.g. "2:30 pm". */
export function timeIn(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(instant))
    .toLowerCase()
    .replace(' ', '');
}

/** 24-hour form, for dense grids where am/pm costs too much width. */
export function time24In(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant));
}

export function dateIn(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(instant));
}

export function shortDateIn(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(instant));
}

/** 'YYYY-MM-DD' as it reads in a zone. Matches the server's day buckets. */
export function dateKeyIn(instant: string | Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(instant));
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function monthLabel(key: string): string {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Do these two zones show the same wall clock right now? */
export function sameClock(a: string, b: string, at: Date = new Date()): boolean {
  return offsetAt(at, a) === offsetAt(at, b);
}

/** Signed hour difference between zones, e.g. "5h behind you". */
export function describeGap(hostZone: string, bookerZone: string, at: Date = new Date()): string {
  const diff = offsetAt(at, hostZone) - offsetAt(at, bookerZone);
  if (diff === 0) return 'same time as you';
  const hours = Math.abs(diff) / 60;
  const label = Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h ${Math.abs(diff) % 60}m`;
  return diff > 0 ? `${label} ahead of you` : `${label} behind you`;
}

export function zoneCity(timeZone: string): string {
  const part = timeZone.split('/').pop() || timeZone;
  return part.replace(/_/g, ' ');
}

/** A curated list first, then everything the browser knows about. */
export function allTimezones(): string[] {
  const common = [
    'Pacific/Auckland', 'Australia/Sydney', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
    'Asia/Kolkata', 'Asia/Dubai', 'Europe/Moscow', 'Europe/Istanbul', 'Europe/Berlin',
    'Europe/Paris', 'Europe/Madrid', 'Europe/Rome', 'Europe/Stockholm', 'Europe/London',
    'Europe/Dublin', 'Atlantic/Reykjavik', 'America/Sao_Paulo', 'America/New_York',
    'America/Toronto', 'America/Chicago', 'America/Mexico_City', 'America/Denver',
    'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'UTC',
  ];
  try {
    const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
    if (!supported) return common;
    const rest = supported.filter((z) => !common.includes(z)).sort();
    return [...common, ...rest];
  } catch {
    return common;
  }
}
