import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="status-shell">
      <div className="status-card">
        <div className="status-icon border border-surface-muted/60 bg-surface-inset">
          <span className="text-2xl font-semibold text-ink-secondary">404</span>
        </div>
        <h1 className="text-2xl font-bold text-ink-primary mb-2">Página no encontrada</h1>
        <p className="text-ink-secondary mb-6">
          El enlace no existe o fue movido. Vuelve al inicio para continuar.
        </p>
        <Link href="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
