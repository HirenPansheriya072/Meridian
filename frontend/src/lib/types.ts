export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  timezone: string;
  avatarColor: string;
  title?: string;
  orgId: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks?: {
    website?: string;
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
  googleCalendar?: {
    connected: boolean;
    email?: string;
  };
  outlookCalendar?: {
    connected: boolean;
    email?: string;
  };
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  logoUrl?: string;
  brandColor?: string;
}

export interface Window {
  start: number;
  end: number;
}

export interface Override {
  _id?: string;
  date: string;
  label?: string;
  windows: Window[];
}

export interface Schedule {
  _id: string;
  name: string;
  weekly: Window[][];
  overrides: Override[];
}

export interface Question {
  _id?: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'phone';
  options: string[];
  required: boolean;
}

export interface EventType {
  _id: string;
  title: string;
  slug: string;
  description: string;
  color: string;
  active: boolean;
  durationMinutes: number;
  slotIncrementMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  maxBookingsPerDay: number;
  assignment: 'single' | 'collective' | 'roundRobin';
  hostIds: string[];
  location: { type: 'video' | 'phone' | 'inPerson' | 'custom'; detail: string };
  questions: Question[];
  requiresConfirmation: boolean;
  redirectUrl?: string;
  bookingCount?: number;
}

export interface Slot {
  startAt: string;
  endAt: string;
  hostIds: string[];
}

export interface DstShift {
  minutes: number;
  direction: 'forward' | 'back';
  from: number;
  to: number;
}

export interface AvailabilityDay {
  date: string;
  weekday: number;
  slots: Slot[];
  dstShift: DstShift | null;
  hostDstShift: DstShift | null;
}

export interface Availability {
  days: AvailabilityDay[];
  timezone: string;
  hostTimezone: string;
  assignment: string;
}

export interface PublicHost {
  id: string;
  name: string;
  title?: string;
  timezone: string;
  avatarColor: string;
}

export interface PublicPage {
  org: { name: string; slug: string };
  eventType: {
    id: string;
    title: string;
    slug: string;
    description: string;
    color: string;
    durationMinutes: number;
    location: { type: string; detail: string };
    questions: Question[];
    assignment: string;
    maximumAdvanceDays: number;
    minimumNoticeMinutes: number;
    redirectUrl?: string;
  };
  hosts: PublicHost[];
}

export interface Booking {
  _id: string;
  id?: string;
  eventTitle: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';
  attendee: { name: string; email: string; notes?: string };
  answers?: Record<string, string>;
  hostIds: { _id: string; name: string; avatarColor: string; timezone: string }[] | string[];
  hostTimezone: string;
  bookerTimezone: string;
  location?: { type: string; detail: string };
  cancelReason?: string;
  manageToken?: string;
}

export interface Summary {
  cards: {
    thisWeek: number;
    total: number;
    cancelled: number;
    cancelRate: number | null;
    hoursBooked: number;
  };
  next: Booking[];
  days: { date: string; label: string; n: number }[];
  byEvent: { title: string; count: number; hours: number }[];
  byZone: { timezone: string; count: number; offset: string }[];
  viewerTimezone: string;
}
