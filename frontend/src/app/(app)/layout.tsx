'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useSession } from '@/lib/queries';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useSession();

  useEffect(() => {
    if (isError) router.replace('/login');
  }, [isError, router]);

  if (isLoading || (!data && !isError)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="spec">Loading your calendar</span>
      </div>
    );
  }
  if (isError) return null;

  return <AppShell>{children}</AppShell>;
}
