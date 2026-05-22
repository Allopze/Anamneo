import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-shell">
          <div className="status-card max-w-sm">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="mt-4 text-sm text-ink-muted">Cargando acceso...</p>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
