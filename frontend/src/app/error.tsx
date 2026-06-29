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
        <div className="status-icon border border-status-red/30 bg-status-red/15">
          <span className="text-2xl font-semibold text-status-red">!</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-ink-primary">No se pudo cargar la app</h1>
        <p className="text-ink-secondary mb-6">
          Reintenta la carga. Si el problema continúa, conserva el contexto y vuelve a iniciar sesión.
        </p>
        <button onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
