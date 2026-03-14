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
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-2xl">⚠️</span>
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
