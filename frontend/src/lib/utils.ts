import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function clockToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function noticeLabel(minutes: number): string {
  if (minutes === 0) return 'No minimum';
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
  return `${Math.round(minutes / 1440)} days`;
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const AVATAR_TONES: Record<string, string> = {
  dusk: 'bg-dusk-soft text-dusk',
  dawn: 'bg-dawn-soft text-dawn-dark',
  sea: 'bg-sea-soft text-sea',
};

export const ASSIGNMENT_LABEL: Record<string, { label: string; note: string }> = {
  single: { label: 'One host', note: 'Bookings go to a single person' },
  collective: { label: 'Everyone', note: 'Only offers times when all hosts are free' },
  roundRobin: { label: 'Round robin', note: 'Offers any free host, balanced by load' },
};

export const LOCATION_LABEL: Record<string, string> = {
  video: 'Video call',
  phone: 'Phone call',
  inPerson: 'In person',
  custom: 'Custom',
};

export const BOOKING_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Awaiting confirmation', className: 'bg-dawn-soft text-dawn-dark' },
  confirmed: { label: 'Confirmed', className: 'bg-sea-soft text-sea' },
  cancelled: { label: 'Cancelled', className: 'bg-rule text-ink-faint' },
  rescheduled: { label: 'Moved', className: 'bg-rule text-ink-faint' },
};

export function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}
