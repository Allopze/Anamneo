import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="status-shell">
      <div className="status-card">
        <div className="status-icon border border-status-yellow/60 bg-status-yellow/35">
          <span className="text-4xl font-bold text-accent-text">404</span>
        </div>
        <h1 className="text-2xl font-bold text-ink-primary mb-2">Página no encontrada</h1>
        <p className="text-ink-secondary mb-6">
          La página que buscas no existe o fue movida.
        </p>
        <Link href="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
