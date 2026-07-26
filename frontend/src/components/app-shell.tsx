'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, LayoutDashboard, Link2, LogOut, Menu, X, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/queries';
import { time24In, zoneCity } from '@/lib/tz';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/event-types', label: 'Event types', icon: Link2 },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/availability', label: 'Availability', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // A live clock in the host's own zone. Small, but it keeps the app's whole
  // premise present: you are always looking at a time somewhere.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  async function signOut() {
    await api.post('/auth/logout');
    qc.clear();
    router.push('/login');
  }

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors',
              active ? 'bg-dusk-soft text-dusk' : 'text-ink-muted hover:bg-rule/50 hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen">
      <aside className="hidden w-[218px] shrink-0 flex-col border-r border-rule bg-surface px-3 py-4 lg:flex">
        <div className="px-2.5 pb-5">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-gradient-to-r from-dawn to-dusk" />
            <span className="font-display text-[15px]">Meridian</span>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-ink-faint">{data?.org?.name}</p>
        </div>
        {nav}

        <div className="mt-auto space-y-2 border-t border-rule pt-3">
          {data?.user && now ? (
            <div className="rounded border border-rule bg-chalk/60 px-2.5 py-2">
              <p className="spec">Your clock</p>
              <p className="tnum mt-0.5 font-mono text-[15px]">{time24In(now, data.user.timezone)}</p>
              <p className="truncate font-mono text-[10px] text-ink-faint">
                {zoneCity(data.user.timezone)}
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-2 px-1">
            <Avatar name={data?.user.name} color={data?.user.avatarColor} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">{data?.user.name}</span>
              <span className="block truncate text-[10px] text-ink-faint">{data?.user.email}</span>
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-ink-muted hover:bg-rule/50 hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[230px] animate-slide-up border-r border-rule bg-surface px-3 py-4">
            <div className="flex items-center justify-between px-2.5 pb-5">
              <span className="font-display text-[15px]">Meridian</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-rule bg-surface px-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-display text-[15px]">Meridian</span>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto scroll-thin">{children}</main>
      </div>
    </div>
  );
}
