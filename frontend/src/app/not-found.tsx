import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="status-shell">
      <div className="status-card">
        <div className="status-icon bg-primary-100">
          <span className="text-4xl font-bold text-primary-600">404</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-slate-600 mb-6">
          La página que buscas no existe o fue movida.
        </p>
        <Link href="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
