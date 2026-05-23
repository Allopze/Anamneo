'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FiDownload, FiShield } from 'react-icons/fi';
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
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-full bg-teal-50 p-3 text-teal-700">
            <FiShield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Descarga segura de ficha clínica</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ingresa el RUT asociado a la solicitud. El enlace es temporal, tiene un máximo de descargas y queda auditado.
            </p>
          </div>
        </div>

        {!token ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            El enlace no incluye token de descarga.
          </div>
        ) : (
          <form onSubmit={handleDownload} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              RUT
              <input
                value={rut}
                onChange={(event) => setRut(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="12.345.678-9"
                autoComplete="off"
              />
            </label>
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || rut.trim().length < 3}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <FiDownload className="h-4 w-4" />
              {loading ? 'Preparando descarga...' : 'Descargar ZIP'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
