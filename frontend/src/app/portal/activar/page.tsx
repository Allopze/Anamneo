'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

export default function PortalActivarPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await portalApi.post('/portal/auth/activate', { token, password, acceptPrivacy, acceptTerms });
      window.location.href = '/portal';
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Activar portal paciente</h1>
        <p className="mt-2 text-sm text-slate-600">Define una contraseña para acceder a tus fichas finalizadas.</p>

        {!token ? (
          <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            El enlace no incluye token de activación.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm text-slate-700">
              Contraseña
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                autoComplete="new-password"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
              Acepto la política de privacidad vigente.
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              Acepto los términos y condiciones vigentes.
            </label>
            {error && <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            <button
              className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={loading || !acceptPrivacy || !acceptTerms}
            >
              {loading ? 'Activando...' : 'Activar cuenta'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
