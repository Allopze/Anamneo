import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
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
