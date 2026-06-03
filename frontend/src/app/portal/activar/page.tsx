'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { portalApi, getErrorMessage } from '@/lib/portal-api';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';

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
    <main className="portal-page-auth">
      <section className="portal-container-form portal-card-form">
        <div className="mb-6 space-y-3">
          <AnamneoLogo
            className="justify-center"
            iconClassName="h-12 w-12 text-ink-primary"
            textClassName="auth-logo-text-on-light text-2xl"
            priority
            inlineIcon
          />
          <p className="text-center text-sm font-semibold text-ink-muted">Portal paciente</p>
        </div>
        <h1 className="portal-title">Activar portal paciente</h1>
        <p className="portal-copy mt-2">Define una contraseña para acceder a tus fichas finalizadas.</p>

        {!token ? (
          <div className="portal-alert-error mt-4">
            El enlace no incluye token de activación.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="portal-label">
              Contraseña
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="portal-input"
                autoComplete="new-password"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-ink-secondary">
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
              Acepto la política de privacidad vigente.
            </label>
            <label className="flex items-start gap-2 text-sm text-ink-secondary">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              Acepto los términos y condiciones vigentes.
            </label>
            {error && <div className="portal-alert-error">{error}</div>}
            <button
              className="portal-button-primary w-full"
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
