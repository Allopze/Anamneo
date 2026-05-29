'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        containerStyle={{
          top: 14,
          left: 16,
          right: 16,
        }}
        toastOptions={{
          duration: 3500,
          ariaProps: {
            role: 'status',
            'aria-live': 'polite',
          },
          style: {
            background: 'var(--surface-elevated)',
            color: 'var(--ink)',
            border: '1px solid rgba(64, 64, 64, 0.12)',
            borderRadius: '16px',
            fontSize: '0.875rem',
            fontWeight: 600,
            lineHeight: 1.45,
            maxWidth: 'min(420px, calc(100vw - 2rem))',
            padding: '0.875rem 1rem',
            boxShadow: '0 18px 45px rgba(43, 43, 43, 0.12)',
          },
          success: {
            iconTheme: {
              primary: 'var(--auth-teal)',
              secondary: 'var(--surface-elevated)',
            },
          },
          error: {
            ariaProps: {
              role: 'alert',
              'aria-live': 'assertive',
            },
            iconTheme: {
              primary: 'var(--status-red)',
              secondary: 'var(--surface-elevated)',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
