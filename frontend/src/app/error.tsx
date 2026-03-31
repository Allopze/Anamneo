'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="status-shell">
      <div className="status-card">
        <div className="status-icon bg-status-red/20">
          <span className="text-3xl font-semibold text-status-red">!</span>
        </div>
        <h1 className="text-2xl font-bold text-ink-primary mb-2">Algo salió mal</h1>
        <p className="text-ink-secondary mb-6">
          Ocurrió un error inesperado. Intenta nuevamente.
        </p>
        <button onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
