'use client';

import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="status-card mx-auto my-12">
      <div className="status-icon h-16 w-16 bg-red-100">
        <span className="text-2xl font-semibold text-red-600">!</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Ocurrió un error</h2>
      <p className="text-slate-600 mb-6 max-w-sm mx-auto">
        No se pudo cargar esta página. Intenta de nuevo o vuelve al inicio.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
        <Link href="/" className="btn btn-secondary">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
