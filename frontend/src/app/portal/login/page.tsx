'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

export default function PortalLoginPage() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get('resetToken');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await portalApi.post('/portal/auth/login', { email, password });
      window.location.href = searchParams.get('next') || '/portal';
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await portalApi.post('/portal/auth/reset-password', { token: resetToken, password: newPassword });
      setMessage('Contraseña actualizada. Ya puedes iniciar sesión.');
      setNewPassword('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError('Ingresa tu correo para recuperar contraseña');
      return;
    }
    try {
      await portalApi.post('/portal/auth/forgot-password', { email });
      setMessage('Si el correo está registrado, recibirás instrucciones.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Portal paciente</h1>
        <p className="mt-2 text-sm text-slate-600">Accede a tus fichas clínicas finalizadas y solicitudes.</p>

        {resetToken ? (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <label className="block text-sm text-slate-700">
              Nueva contraseña
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white" disabled={loading}>
              Actualizar contraseña
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm text-slate-700">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                autoComplete="email"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Contraseña
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                autoComplete="current-password"
              />
            </label>
            <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" onClick={handleForgot} className="w-full text-sm text-teal-700 underline">
              Recuperar contraseña
            </button>
          </form>
        )}

        {message && <div className="mt-4 rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</div>}
        {error && <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        <Link href="/derechos" className="mt-6 block text-center text-xs text-slate-500 underline">
          Solicitar copia sin cuenta portal
        </Link>
      </section>
    </main>
  );
}
