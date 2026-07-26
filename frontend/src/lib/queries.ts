'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';
import type { Availability, Booking, EventType, Org, PublicPage, Schedule, Summary, User } from './types';

export const keys = {
  session: ['session'] as const,
  team: ['team'] as const,
  eventTypes: ['event-types'] as const,
  eventType: (id: string) => ['event-type', id] as const,
  schedule: ['schedule'] as const,
  bookings: (range: string) => ['bookings', range] as const,
  summary: ['summary'] as const,
  publicPage: (org: string, event: string) => ['public', org, event] as const,
  availability: (org: string, event: string, from: string, to: string, timezone: string) =>
    ['availability', org, event, from, to, timezone] as const,
  managed: (token: string) => ['managed', token] as const,
};

export function useSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: () => api.get<{ user: User; org: Org }>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useTeam() {
  return useQuery({
    queryKey: keys.team,
    queryFn: () => api.get<{ items: User[] }>('/team'),
    staleTime: 5 * 60_000,
  });
}

export function useEventTypes() {
  return useQuery({
    queryKey: keys.eventTypes,
    queryFn: () => api.get<{ items: EventType[] }>('/event-types'),
  });
}

export function useEventType(id: string) {
  return useQuery({
    queryKey: keys.eventType(id),
    queryFn: () => api.get<{ eventType: EventType }>(`/event-types/${id}`),
    enabled: Boolean(id) && id !== 'new',
  });
}

export function useSaveEventType(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      id && id !== 'new'
        ? api.patch<{ eventType: EventType }>(`/event-types/${id}`, body)
        : api.post<{ eventType: EventType }>('/event-types', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.eventTypes });
      toast.success(id && id !== 'new' ? 'Saved' : 'Created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEventType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.del<{ deleted?: boolean; deactivated?: boolean; message?: string }>(`/event-types/${id}`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.eventTypes });
      toast.success(data.message || 'Deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSchedule() {
  return useQuery({
    queryKey: keys.schedule,
    queryFn: () => api.get<{ schedule: Schedule; timezone: string }>('/schedule'),
  });
}

export function useSaveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.put<{ schedule: Schedule }>('/schedule', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.schedule });
      toast.success('Hours saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBookings(range: string) {
  return useQuery({
    queryKey: keys.bookings(range),
    queryFn: () =>
      api.get<{ items: Booking[]; counts: { upcoming: number; past: number; cancelled: number } }>(
        `/bookings?range=${range}`
      ),
    placeholderData: (prev) => prev,
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/bookings/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: keys.summary });
      toast.success('Booking cancelled');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSummary() {
  return useQuery({ queryKey: keys.summary, queryFn: () => api.get<Summary>('/summary') });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      title?: string;
      timezone?: string;
      avatarUrl?: string;
      bio?: string;
      socialLinks?: {
        website?: string;
        linkedin?: string;
        twitter?: string;
        instagram?: string;
      };
    }) => api.patch<{ user: User }>('/auth/profile', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.session });
      qc.invalidateQueries({ queryKey: keys.schedule });
      toast.success('Profile updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; brandColor?: string; logoUrl?: string }) =>
      api.patch<{ org: Org }>('/auth/org', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.session });
      toast.success('Organization updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ---------- public booking flow ---------- */

export function usePublicPage(orgSlug: string, eventSlug: string) {
  return useQuery({
    queryKey: keys.publicPage(orgSlug, eventSlug),
    queryFn: () => api.get<PublicPage>(`/public/${orgSlug}/${eventSlug}`),
    enabled: Boolean(orgSlug && eventSlug),
    retry: false,
  });
}

export function useAvailability(
  orgSlug: string,
  eventSlug: string,
  from: string,
  to: string,
  timezone: string
) {
  return useQuery({
    queryKey: keys.availability(orgSlug, eventSlug, from, to, timezone),
    queryFn: () =>
      api.get<Availability>(
        `/public/${orgSlug}/${eventSlug}/availability?from=${from}&to=${to}&timezone=${encodeURIComponent(timezone)}`
      ),
    enabled: Boolean(orgSlug && eventSlug && from && to && timezone),
    // Slots go stale fast -- someone else may be booking the same one right now.
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useCreateBooking(orgSlug: string, eventSlug: string) {
  return useMutation({
    mutationFn: (body: {
      startAt: string;
      timezone: string;
      name: string;
      email: string;
      notes?: string;
      answers?: Record<string, string>;
    }) =>
      api.post<{
        booking: { id: string; manageToken: string; startAt: string; status: string };
        manageUrl: string;
      }>(`/public/${orgSlug}/${eventSlug}/book`, body),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useManagedBooking(token: string) {
  return useQuery({
    queryKey: keys.managed(token),
    queryFn: () =>
      api.get<{
        booking: Booking;
        hosts: { name: string; timezone: string; avatarColor: string }[];
        org: { name: string; slug: string };
        eventSlug: string;
      }>(`/booking/${token}`),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useCancelByToken(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => api.post(`/booking/${token}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.managed(token) });
      toast.success('Booking cancelled');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRescheduleByToken(token: string) {
  return useMutation({
    mutationFn: (body: { startAt: string; timezone: string }) =>
      api.post<{ booking: { manageToken: string }; manageUrl: string }>(
        `/booking/${token}/reschedule`,
        body
      ),
    onError: (e: Error) => toast.error(e.message),
  });
}
