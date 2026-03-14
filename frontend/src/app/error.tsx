'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
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
