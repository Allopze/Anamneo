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
        <div className="status-icon bg-red-100">
          <span className="text-3xl font-semibold text-red-600">!</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Algo salió mal</h1>
        <p className="text-slate-600 mb-6">
          Ocurrió un error inesperado. Intenta nuevamente.
        </p>
        <button onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
