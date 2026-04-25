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
            <div className="status-icon bg-status-red/20">
              <span className="text-3xl font-semibold text-status-red">!</span>
            </div>
            <h1 className="text-2xl font-bold text-ink-primary mb-2">Algo salió mal</h1>
            <p className="text-ink-secondary mb-6 max-w-sm">
              Ocurrió un error inesperado en la aplicación. El evento quedó registrado y puedes intentar cargar nuevamente.
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