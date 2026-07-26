'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => {
              if (error instanceof ApiError && error.status < 500) return false;
              return count < 2;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: '4px',
            border: '1px solid #E0DFD9',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
