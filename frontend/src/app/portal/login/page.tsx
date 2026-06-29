'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { FiFileText, FiMail, FiShield } from 'react-icons/fi';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { LockIcon } from '@/components/icons';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

const PORTAL_LOGIN_CHIPS = [
  {
    icon: <FiFileText className="h-7 w-7" aria-hidden="true" />,
    label: 'Fichas finalizadas',
    description: 'Consulta documentos clínicos disponibles para descarga.',
  },
  {
    icon: <FiShield className="h-7 w-7" aria-hidden="true" />,
    label: 'Solicitudes trazables',
    description: 'Tus solicitudes de datos quedan registradas.',
  },
];

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
    <AuthFrame
      variant="loginCompact"
      eyebrow="Portal paciente"
      title="Acceso seguro a tus documentos clínicos."
      description="Revisa fichas finalizadas, solicitudes y trazabilidad de accesos desde un espacio reservado para pacientes."
      chips={PORTAL_LOGIN_CHIPS}
      cardEyebrow="Portal"
      cardTitle={resetToken ? 'Crear nueva contraseña' : 'Ingresar al portal'}
      cardDescription={
        resetToken
          ? 'Define una nueva contraseña para recuperar tu acceso.'
          : 'Accede con las credenciales entregadas por el equipo clínico.'
      }
      logoIconClassName="!h-14 !w-14 lg:!h-20 lg:!w-20"
      logoTextClassName="!text-3xl lg:!text-4xl"
      heroFooter={
        <div className="auth-help">
          <LockIcon className="h-7 w-7" aria-hidden="true" />
          <span>
            <span className="auth-help-title">Acceso auditado</span>
            <span className="auth-help-copy">Cada ingreso queda registrado para tu seguridad.</span>
          </span>
        </div>
      }
      footer={
        <div className="space-y-3 text-center">
          <Link href="/derechos" className="auth-inline-link justify-center">
            Solicitar copia sin cuenta portal
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-ink-muted">
            <Link href="/login" className="auth-inline-link">Acceso clínico</Link>
            <span aria-hidden="true">·</span>
            <Link href="/politica-de-privacidad" className="auth-inline-link">Privacidad</Link>
          </div>
        </div>
      }
    >
      {message && <div className="portal-alert-success mb-4">{message}</div>}
      {error && <div className="portal-alert-error mb-4">{error}</div>}

      {resetToken ? (
        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <label htmlFor="portal-new-password" className="form-label">Nueva contraseña</label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id="portal-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="form-input pl-10"
                autoComplete="new-password"
              />
            </div>
          </div>
          <button className="btn btn-accent w-full py-3" disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="portal-email" className="form-label">Correo electrónico</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id="portal-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="form-input pl-10"
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </div>
          <div>
            <label htmlFor="portal-password" className="form-label">Contraseña</label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id="portal-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="form-input pl-10"
                autoComplete="current-password"
              />
            </div>
          </div>
          <button className="btn btn-accent w-full py-3" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar al portal'}
          </button>
          <button type="button" onClick={handleForgot} className="auth-secondary-action">
            Recuperar contraseña
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
