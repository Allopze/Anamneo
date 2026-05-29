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
    <main className="portal-page-auth">
      <section className="portal-container-form portal-card-form">
        <h1 className="portal-title">Portal paciente</h1>
        <p className="portal-copy mt-2">Accede a tus fichas clínicas finalizadas y solicitudes.</p>

        {resetToken ? (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <label className="portal-label">
              Nueva contraseña
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="portal-input"
              />
            </label>
            <button className="portal-button-primary w-full" disabled={loading}>
              Actualizar contraseña
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="portal-label">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="portal-input"
                autoComplete="email"
              />
            </label>
            <label className="portal-label">
              Contraseña
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="portal-input"
                autoComplete="current-password"
              />
            </label>
            <button className="portal-button-primary w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" onClick={handleForgot} className="portal-button-secondary w-full">
              Recuperar contraseña
            </button>
          </form>
        )}

        {message && <div className="portal-alert-success mt-4">{message}</div>}
        {error && <div className="portal-alert-error mt-4">{error}</div>}
        <Link href="/derechos" className="portal-link mt-6 block text-center text-xs">
          Solicitar copia sin cuenta portal
        </Link>
      </section>
    </main>
  );
}
