'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FiDownload, FiShield } from 'react-icons/fi';
import { AlertBanner } from '@/components/common/AlertBanner';
import { api, getErrorMessage } from '@/lib/api';

export default function DescargarFichaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [rut, setRut] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDownload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post(
        `/public/data-request-downloads/${encodeURIComponent(token)}/download`,
        { requesterRut: rut },
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ficha-clinica.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center bg-surface-base px-4 py-10 text-ink">
      <section className="mx-auto max-w-xl rounded-card border border-surface-muted/70 bg-surface-elevated p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-full border border-surface-muted/60 bg-surface-inset p-3 text-auth-teal">
            <FiShield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Descarga segura de ficha clínica</h1>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              Ingresa el RUT asociado a la solicitud. El enlace es temporal, tiene un máximo de descargas y queda auditado.
            </p>
          </div>
        </div>

        {!token ? (
          <AlertBanner
            variant="error"
            title="Enlace incompleto"
            message="El enlace no incluye token de descarga. Solicita un nuevo enlace al equipo clínico."
          />
        ) : (
          <form onSubmit={handleDownload} className="space-y-4">
            <label className="form-label">
              RUT
              <input
                value={rut}
                onChange={(event) => setRut(event.target.value)}
                className="form-input mt-1"
                placeholder="12.345.678-9"
                autoComplete="off"
              />
            </label>
            {error && (
              <AlertBanner variant="error" message={error} />
            )}
            <button
              type="submit"
              disabled={loading || rut.trim().length < 3}
              className="btn btn-primary w-full"
            >
              <FiDownload className="h-4 w-4" />
              {loading ? 'Preparando descarga...' : 'Descargar archivo ZIP'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
