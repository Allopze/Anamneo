'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
};

export default function GlobalError({
  error,
  reset,
  unstable_retry: unstableRetry,
}: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const handleRetry = () => {
    if (typeof unstableRetry === 'function') {
      unstableRetry();
      return;
    }

    reset?.();
  };

  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="status-shell">
          <div className="status-card">
            <div className="status-icon border border-status-red/30 bg-status-red/15">
              <span className="text-2xl font-semibold text-status-red">!</span>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-ink-primary">No se pudo cargar Anamneo</h1>
            <p className="text-ink-secondary mb-6 max-w-sm">
              Registramos el evento. Reintenta la carga para volver a tu sesión clínica.
            </p>
            <button onClick={handleRetry} className="btn btn-primary">
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
